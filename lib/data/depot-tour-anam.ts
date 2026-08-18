import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";

/**
 * depot-tour-anam.ts — LE CÔTÉ D'ANAM DU JOURNAL (revue des Epics 1 à 4, trouvaille #6).
 *
 * ⚠️ MODULE SÉPARÉ DE `depot-journal.ts`, DÉLIBÉRÉMENT. Celui-là écrit sous JWT et l'annonce en
 * tête : « JAMAIS `service_role` — le journal est POSSÉDÉ par l'utilisatrice ». La règle vaut pour
 * SA moitié à elle. Celle d'Anam est l'inverse exact : 0016 épingle `role = 'utilisatrice'` dans la
 * policy pour qu'aucune session ne puisse forger des paroles d'Anam, immuables. Les deux moitiés
 * n'ont donc pas le même écrivain, et mélanger les deux dans un fichier ferait croire le contraire.
 *
 * La garde ne vit pas ici mais dans la RPC (0068) : elle exige que le tour d'ELLE existe sous la
 * même clé — preuve que la policy art. 9 est passée pour ce tour précis, sans re-dériver ses
 * conditions. Une garde en TypeScript ne garderait rien : `service_role` traverse la RLS.
 *
 * ÉCHEC = INCIDENT, JAMAIS UNE PANNE DE TOUR. À l'inverse du tour d'ELLE — qu'on refuse de diffuser
 * si on n'a pas pu le graver, parce qu'on ne peut pas promettre de conserver ce qu'on n'a pas écrit —
 * la réponse d'Anam a DÉJÀ été lue quand on la grave. Faire échouer le tour à ce moment-là ne
 * rendrait rien à personne : ça effacerait de son écran une réponse qu'elle vient de lire.
 */
export async function consignerTourAnam(
  utilisatriceId: string,
  cleTour: string,
  contenu: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("consigner_tour_anam", {
    cible: utilisatriceId,
    p_cle_tour: cleTour,
    p_contenu: contenu,
  });
  if (error) throw new Error(`consigner_tour_anam: ${error.code ?? "echec"}`);
}
