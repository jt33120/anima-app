import { NextResponse } from "next/server";
import { santePublique } from "@/lib/data/depot-ordonnanceur";

// Route de santé — sert de test de fumée (l'app démarre et une route répond).
//
// Story 4.8 (AC5) : elle porte en plus l'état AGRÉGÉ de l'ordonnanceur — un mot, et rien d'autre. La route
// est publique et non authentifiée : ni nom de job, ni horodatage, ni compteur n'y transitent. La discrétion
// est portée par la signature de `sante_ordonnanceur_publique`, qui ne renvoie qu'un mot — la route ne peut
// donc pas en dire plus, même par accident. Une base injoignable rend `inconnu` sans dégrader le test de fumée.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: "ok", app: "anam", ordonnanceur: await santePublique() });
}
