import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { chargerExport } from "@/lib/data/exporter-donnees";
import { nomFichierExport, rendreExportLisible } from "@/lib/domain/export-lisible";
import { ENTETES_ART9 } from "@/lib/ai/entetes-art9";
import { journaliserIncidentSecurite } from "@/lib/safety/rpc-repli";

/**
 * /api/export — L'EXPORT COMPLET (Story 6.6 · FR-067 volet export · AD-4 · NFR-002/003/005).
 *
 * ══ CETTE ROUTE EXISTAIT DÉJÀ, ET C'EST POUR ÇA QU'ELLE EST RÉÉCRITE ICI ════════════════════════
 *
 * La Story 1.9 l'avait ouverte pour tenir sa promesse « un export proposé avant suppression », en
 * disant explicitement : « SCOPE 1.9 : export MINIMAL et honnête […] l'export EXHAUSTIF FR-067 est
 * la Story 6.6, qui élargira ce seam. » Elle servait quatre morceaux sur vingt-neuf : le compte, le
 * consentement, les synthèses, la préférence de courriel. Ni le journal, ni les branches, ni les
 * faits, ni le thème natal, ni les lectures.
 *
 * ⚠️ ON ÉLARGIT CELLE-CI, ON N'EN OUVRE PAS UNE SECONDE. Deux exports coexistants seraient le pire
 * résultat possible : `/barriere` continuerait de pointer vers l'ancien, et une adolescente barrée —
 * précisément celle qui a trente jours pour tout emporter (FR-071) — repartirait avec quatre
 * morceaux en croyant tout tenir. Le lien de `/barriere` est inchangé et sert désormais le document
 * complet.
 *
 * ══ POURQUOI UN GET QUI ÉCRIT ═══════════════════════════════════════════════════════════════════
 *
 * La RPC pose une trace d'accès (AC3). Un GET à effet est en principe suspect ; ici l'effet est
 * exactement celui d'un journal d'accès, et il est INSÉPARABLE de la lecture par construction —
 * c'est ce qu'on voulait. Le GET, lui, est imposé par l'appelant : `/barriere` propose l'export par
 * un `<a href>` en UNE action, et l'AC3 de la 1.9 comme l'AC1 d'ici interdisent d'ajouter un geste.
 * Aucun préchargement ne peut le déclencher : `next/link` ne préfetche que des pages, pas les `<a>`
 * bruts vers une route d'API.
 *
 * ══ `application/octet-stream`, ET CE N'EST PAS UNE NÉGLIGENCE ══════════════════════════════════
 *
 * Le corps est du HTML fabriqué avec SON texte à elle. Servi en `text/html` depuis notre origine, il
 * suffirait qu'un navigateur ignore le `Content-Disposition` pour que tout ce qu'elle a écrit
 * s'exécute DANS l'origine de l'application. `rendreExportLisible` échappe tout — mais une seule
 * défense, sur un chemin où le contenu est intégralement contrôlé par l'utilisatrice, c'est une
 * défense de trop peu. En `octet-stream` + `nosniff`, aucun navigateur ne peut le rendre en ligne ;
 * ouvert depuis son disque, le fichier reste un HTML parfaitement valide (son `<meta charset>` et sa
 * CSP voyagent dedans).
 */

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/entrer", request.url));

  // ⚠️ AUCUNE GARDE D'ONBOARDING ICI, ET C'EST LA DÉCISION DE LA 1.9 QU'ON GARDE. Un compte suspendu
  // sous barrière de minorité DOIT pouvoir exporter — c'est le sens même de « un export proposé
  // avant suppression » (FR-071, AD-14). Quelqu'un qui a révoqué aussi : l'accès (art. 15) survit à
  // la révocation, comme l'effacement (art. 17). La seule condition est d'être soi.
  let document;
  try {
    document = await chargerExport(supabase);
  } catch (e) {
    // NFR-022 : le code seul. Et surtout : on ne sert PAS un document partiel ni vide — sur cet
    // écran-là, un fichier léger se lirait comme « il ne reste rien de moi ».
    journaliserIncidentSecurite("export_complet", e);
    return NextResponse.redirect(new URL("/mes-donnees?echec=1", request.url));
  }

  return new NextResponse(rendreExportLisible(document), {
    headers: {
      ...ENTETES_ART9,
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${nomFichierExport(document)}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
