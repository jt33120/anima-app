import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { creerDepotOrdonnanceur } from "@/lib/data/depot-ordonnanceur";
import { executerOrdonnanceur } from "@/lib/ordonnanceur/executer";

/**
 * Story 4.8 (AC1/AC3) — LA PORTE UNIQUE de l'ordonnanceur. L'ordonnanceur externe l'appelle ; personne d'autre ne le
 * peut. C'est le seul point d'entrée d'un mécanisme périodique dans tout le produit, et un test de garde
 * casse le build si un second apparaît (AC4).
 *
 * En GET, parce que l'ordonnanceur externe émet des GET — ce qui rend l'authentification d'autant plus critique : un
 * GET est ce qu'un navigateur, un aspirateur de liens ou un préchargeur émettent le plus facilement.
 */
export const dynamic = "force-dynamic";
// ⚠️ UN LITTÉRAL, et jamais une constante importée : Next exige une valeur statiquement analysable,
// et une expression est IGNORÉE EN SILENCE — la plateforme retombe alors sur son défaut. Sa valeur
// doit égaler `Math.ceil(BUDGET_TICK_MS / 1000)` (`lib/domain/ordonnanceur-budget.ts`), et deux
// assertions distinctes gardent cette couture : l'une que c'est bien un nombre écrit en clair,
// l'autre que c'est le bon. Aucune ne remplace l'autre.
//
// Ce 60 n'a jamais été un plafond de plateforme — le palier `hobby` en autorise 300. Le monter sans
// job pour le justifier reconstruirait le mou dans lequel les gardes cessent de mordre (Story 6.1).
export const maxDuration = 74;

/**
 * Comparaison à temps constant. On HACHE avant de comparer plutôt que de comparer les chaînes : `===`
 * s'arrête au premier octet différent et laisse donc fuir le préfixe par le temps de réponse, et
 * `timingSafeEqual` exige des tampons de même longueur — ce qui, appliqué aux secrets bruts, ferait fuir
 * la longueur. Deux empreintes SHA-256 font toujours 32 octets, quel qu'ait été l'original.
 */
function secretValide(fourni: string, attendu: string): boolean {
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(fourni), h(attendu));
}

export async function GET(request: Request): Promise<Response> {
  const attendu = process.env.CRON_SECRET;
  // Secret absent = porte ouverte. On refuse de servir plutôt que d'exécuter sans savoir qui appelle : un
  // ordonnanceur non authentifié est déclenchable par n'importe qui, et l'Epic 6 lui confiera la rétention.
  if (!attendu) {
    return NextResponse.json({ code: "ordonnanceur_non_configure" }, { status: 503 });
  }

  const entete = request.headers.get("authorization") ?? "";
  const fourni = entete.startsWith("Bearer ") ? entete.slice(7) : "";
  if (!fourni || !secretValide(fourni, attendu)) {
    return NextResponse.json({ code: "non_autorise" }, { status: 401 });
  }

  const rapport = await executerOrdonnanceur({ depot: creerDepotOrdonnanceur() });
  // 409 sur un refus d'environnement : ce n'est ni un succès (rien n'a tourné) ni une panne (tout a
  // fonctionné comme prévu). Un 200 ferait croire à une exécution ; un 500 ferait chercher un bug.
  return NextResponse.json(rapport, { status: rapport.execute ? 200 : 409 });
}
