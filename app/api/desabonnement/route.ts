import { type NextRequest, NextResponse } from "next/server";
import { reglerCourriels } from "@/lib/courriel/desabonnement";

/**
 * Story 4.9 / revue T5-2 — LE DÉSABONNEMENT EN UN CLIC (RFC 8058).
 *
 * C'est la cible de l'en-tête `List-Unsubscribe` : Gmail et Yahoo l'exigent depuis février 2024 pour tout
 * expéditeur en volume, et c'est ce qui fait apparaître un bouton « Se désabonner » À CÔTÉ de l'expéditeur,
 * avant même l'ouverture du message. Sans lui, le geste que le client de messagerie propose à la place est
 * « signaler comme spam » — et une plainte pour spam sur un courriel signé « Anam » coûte à la fois la
 * réputation d'envoi et la confiance de la personne.
 *
 * POST SEULEMENT, et c'est la garde qui compte ici. Les scanners de sécurité et les prévisualisateurs de
 * lien suivent les GET : un désabonnement sur GET serait déclenché par un antivirus d'entreprise, et elle
 * cesserait de recevoir ses annonces sans avoir rien fait ni rien su. Le chemin humain passe donc par
 * `/desabonnement`, qui montre d'abord une page et demande un geste.
 *
 * La réponse ne dit RIEN de plus que « c'est reçu » : jeton connu ou non, même 200, même corps. Une
 * réponse qui distinguerait les deux ferait de cette route un oracle d'existence de compte, appelable par
 * n'importe qui.
 */
export async function POST(request: NextRequest) {
  await reglerCourriels(request.nextUrl.searchParams.get("j"), true);

  return new NextResponse("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
