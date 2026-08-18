import type { MetadataRoute } from "next";
import { siteIndexable } from "@/lib/domain/environnement";

/**
 * robots.ts — LA PREMIÈRE DES DEUX COUCHES QUI TIENNENT LES MOTEURS DEHORS (porte §7).
 *
 * ⚠️ `robots.txt` NE SUFFIT PAS, ET C'EST POURQUOI IL Y EN A DEUX. Un `Disallow` demande de ne pas
 * EXPLORER ; il n'interdit pas d'INDEXER. Une URL découverte ailleurs — un lien, une barre
 * d'adresse, un certificat — peut paraître dans les résultats avec son seul titre, précisément
 * parce que le moteur s'est interdit d'aller lire la page qui aurait dit « n'indexe pas ».
 * L'en-tête `X-Robots-Tag` posé par `proxy.ts` est la couche qui interdit, elle, d'indexer.
 *
 * Les deux lisent le MÊME prédicat. Deux lectures d'une même question écrites à deux endroits
 * finissent par ne plus dire la même chose (leçon R1 de la revue Epic 6) — ici l'écart serait un
 * site à moitié fermé, c'est-à-dire ouvert.
 *
 * ⚠️ `dynamic = "force-dynamic"` EST LA GARDE, PAS UN RÉGLAGE. Sans elle, Next fige ce fichier au
 * BUILD : poser `ANIMA_INDEXABLE` sur l'hébergeur n'ouvrirait rien tant qu'on n'aurait pas
 * redéployé, et — bien plus grave — la RETIRER ne refermerait rien. Une garde qu'on ne peut pas
 * refermer sans redéployer n'est pas une garde.
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (!siteIndexable(process.env)) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  // Ouvert : on laisse explorer les pages publiques, jamais les surfaces authentifiées ni l'API.
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/mes-donnees", "/reglages"] }],
  };
}
