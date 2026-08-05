import "server-only";
import type { DepotOrdonnanceur } from "@/lib/data/depot-ordonnanceur";

/**
 * Story 4.8 (AC3) — LE VERROU D'ENVIRONNEMENT.
 *
 * Deux sources, et on n'exécute que si elles s'accordent :
 *   • ce que le DÉPLOIEMENT croit être (`ANIMA_ENV`) ;
 *   • ce que la BASE déclare être (table `environnement`).
 *
 * Le scénario visé n'est pas une attaque, c'est une maladresse : une préversion Vercel où l'on a collé
 * l'URL Supabase de prod. Sans verrou, tout a l'air normal — jusqu'au jour où l'Epic 6 branche la rétention
 * sur cet ordonnanceur et où un déploiement de test efface des données réelles.
 */

const RECONNUS = ["local", "preview", "production"] as const;
export type Environnement = (typeof RECONNUS)[number];

export type VerdictEnvironnement =
  | { readonly accorde: true; readonly environnement: Environnement }
  | { readonly accorde: false; readonly motif: "desaccord" | "base_muette"; readonly deploiement: Environnement };

/**
 * Ce que le déploiement croit être. Absent ou méconnaissable → `local`.
 *
 * Ce repli a l'air laxiste ; il est en fait le plus sûr des trois. `local` ne s'accorde qu'avec une base
 * `local` : un déploiement de prod dont on aurait oublié de régler `ANIMA_ENV` se retrouve donc face à une
 * base qui dit `production` — désaccord, refus, aucun effet. Replier sur `production` ferait l'inverse :
 * un oubli de configuration deviendrait un droit d'écrire dans la vraie base.
 */
export function environnementDuDeploiement(): Environnement {
  const brut = process.env.ANIMA_ENV?.trim();
  return RECONNUS.includes(brut as Environnement) ? (brut as Environnement) : "local";
}

export async function verifierEnvironnement(depot: DepotOrdonnanceur): Promise<VerdictEnvironnement> {
  const deploiement = environnementDuDeploiement();
  const declare = await depot.environnementDeclare();
  // Base muette (marqueur absent, table illisible, connexion morte) : on ne sait pas où l'on est. Le repli
  // est le REFUS. « Dans le doute, exécuter quand même » est la formulation exacte de l'accident qu'on veut
  // empêcher (AD-15 : le repli va toujours vers le moins d'effet).
  if (declare === null) return { accorde: false, motif: "base_muette", deploiement };
  if (declare !== deploiement) return { accorde: false, motif: "desaccord", deploiement };
  return { accorde: true, environnement: deploiement };
}
