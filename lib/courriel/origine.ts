import "server-only";

/**
 * Story 4.9 / revue T5-1 — L'ORIGINE DU SITE, lue dans la configuration, jamais inventée.
 *
 * ── CE QUI A ÉTÉ TROUVÉ, ET POURQUOI C'EST GRAVE ───────────────────────────────────────────────────────
 *
 * Le gabarit portait `https://anima.app/synthese` en dur. Résolution DNS réelle au moment de la revue :
 * `anima.app` est un domaine PARQUÉ, EN VENTE chez Afternic (NS afternic, MX null). Cette URL
 * n'apparaissait nulle part ailleurs dans le dépôt — ni dans `next.config.ts`, ni dans `vercel.json`, ni
 * dans `.env.example`. Elle n'était reliée à aucun déploiement : c'était une invention.
 *
 * Deux conséquences, dont la seconde est celle qui compte. Elle clique et tombe sur une page de parking —
 * désagréable. Et surtout : **n'importe qui peut acheter ce domaine** et servir une fausse page de
 * connexion Anam sur `/synthese`, à des femmes qu'un courriel signé « Anam » vient d'avertir qu'un texte
 * intime les attend. Le courriel du produit devient alors le véhicule de l'hameçonnage, avec sa
 * crédibilité intacte.
 *
 * ── LA RÈGLE ───────────────────────────────────────────────────────────────────────────────────────────
 *
 * Pas d'origine configurée ⇒ AUCUN courriel ne part (la fabrique rend le port non configuré). C'est la
 * même stratégie que la clé Resend absente : la synthèse est produite et consultable, aucune réservation
 * n'est consommée, et le jour où la configuration arrive, l'annonce part. Un lien mort vaut mieux qu'un
 * lien vers un domaine qu'on ne possède pas ; ne rien envoyer vaut mieux que les deux.
 *
 * ── LA MARQUE NOMINALE ─────────────────────────────────────────────────────────────────────────────────
 *
 * `Origine` est une chaîne MARQUÉE : seul `origineDuSite()` peut en produire une. C'est ce qui permet au
 * gabarit d'accepter un trou sans redevenir un gabarit interpolable — le type interdit d'y verser du
 * texte libre, et donc d'y verser un jour un fragment de synthèse.
 */

declare const marqueOrigine: unique symbol;
export type Origine = string & { readonly [marqueOrigine]: true };

/** Développement uniquement : le seul hôte pour lequel `http:` est toléré. */
const HOTES_LOCAUX = new Set(["localhost", "127.0.0.1"]);

/**
 * Valide et normalise une origine. Rend `null` — jamais une valeur approximative — dès qu'un doute existe.
 *
 * Ce qui est refusé, et pourquoi chaque refus est là :
 *   • `http:` hors local — un lien en clair dans un courriel est interceptable et rétrogradable ;
 *   • un identifiant dans l'URL (`https://x:y@hôte`) — la forme classique du lien d'hameçonnage, où
 *     l'hôte affiché n'est pas l'hôte visité ;
 *   • un chemin, une requête ou un fragment — on construit les chemins ici ; une origine qui en porte
 *     déjà produirait `https://hôte/base/synthese` ou pire, un `?` avalant la suite ;
 *   • une chaîne non analysable — `new URL` lève, on ne devine pas.
 */
export function validerOrigine(brut: string | null | undefined): Origine | null {
  const propre = (brut ?? "").trim().replace(/\/+$/, "");
  if (propre.length === 0) return null;

  let url: URL;
  try {
    url = new URL(propre);
  } catch {
    return null;
  }

  const local = HOTES_LOCAUX.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
  if (url.username !== "" || url.password !== "") return null;
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") return null;

  return url.origin as Origine;
}

/** L'origine du déploiement, ou `null`. `ANIMA_SITE_URL` est SERVEUR : rien de ceci n'atteint le client. */
export function origineDuSite(): Origine | null {
  return validerOrigine(process.env.ANIMA_SITE_URL);
}
