import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { HEURE_PAR_DEFAUT, palierHonoreLHeure } from "@/lib/domain/socle-quotidien";
import * as copie from "@/lib/domain/copie-reglages";
import Reglages from "@/render/reglages/Reglages";
import s from "@/render/reglages/reglages.module.css";
import { abonnerAppareil, choisirHeure, desabonnerAppareil } from "./actions";

// NFR-015 / identité de route — « Anam » partout, jamais un titre qui dit l'intimité de la page.
export const metadata = { title: "Anam" };

/** État de compte : jamais mis en cache, jamais pré-rendu. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * /reglages — LA HALTE DES RÉGLAGES (Story 6.2, AC4 · décision D9).
 *
 * Elle naît ici parce que l'AC4 exige que la permission de notification soit demandée « en contexte,
 * depuis les réglages », et qu'il n'existait aucun écran de réglages. Elle ne porte QUE le rythme
 * quotidien — pas le menu de compte complet, qui reste à concevoir. Comme `/lectures`, `/synthese` et
 * `/ancrages`, elle n'est atteignable que par URL tant que ce menu n'existe pas : dette déjà inscrite,
 * commune aux cinq haltes désormais.
 *
 * ── CE QUE LE SERVEUR DÉCIDE ET CE QUE LE CLIENT NE PEUT PAS SAVOIR ────────────────────────────────
 *
 * `abonneIci` est lu en base, pas dans le navigateur, et les deux peuvent diverger — un abonnement
 * révoqué depuis les réglages du système laisse la ligne en base. C'est assumé : la base est la
 * source de vérité de ce que le PRODUIT enverra, le navigateur celle de ce qu'il AFFICHERA. Le
 * bouton « ne plus rien recevoir » défait les deux ; c'est le seul geste qui les réaligne, et il est
 * toujours disponible.
 *
 * `enService` est le palier (`palierHonoreLHeure`). Sur `hobby`, l'écran le DIT plutôt que d'accepter
 * en silence un réglage qui ne produira rien — lui promettre une notification qui n'arrivera pas
 * serait une panne invisible pour elle comme pour nous.
 */
export default async function PageReglages() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  // Deux lectures sous le JWT de l'utilisatrice, jamais `service_role` (AD-12). Les policies de 0053
  // ne lui montrent que ses propres lignes — c'est la base qui le garantit, pas ce fichier.
  const [{ data: preference }, { count }] = await Promise.all([
    supabase.from("preference_socle").select("heure").eq("utilisatrice_id", user.id).maybeSingle(),
    supabase.from("abonnement_poussee").select("id", { count: "exact", head: true }),
  ]);

  return (
    <main className={s.halte}>
      <h1 className={s.titreHalte}>{copie.TITRE_HALTE}</h1>
      <Reglages
        // La copie descend d'ici : `render/` est un adaptateur muet et n'importe pas `lib/domain`
        // (AD-7, gardé par arc-architecture et scene-architecture). Même geste qu'en `/ancrages`.
        copie={{
          section: copie.SECTION_SOCLE,
          description: copie.DESCRIPTION_SOCLE,
          activer: copie.ACTIVER,
          desactiver: copie.DESACTIVER,
          labelHeure: copie.LABEL_HEURE,
          etatActif: copie.ETAT_ACTIF,
          etatInactif: copie.ETAT_INACTIF,
          permissionRefusee: copie.PERMISSION_REFUSEE,
          indisponible: copie.INDISPONIBLE,
          echec: copie.ECHEC,
          pasEncoreActif: copie.PAS_ENCORE_ACTIF,
        }}
        // La clé PUBLIQUE, et elle est publique : le navigateur en a besoin pour souscrire, et elle
        // est de toute façon renvoyée dans chaque en-tête VAPID. La privée ne quitte jamais le
        // serveur — elle n'est même pas lue dans ce fichier.
        clePublique={process.env.VAPID_CLE_PUBLIQUE?.trim() ?? null}
        abonneIci={(count ?? 0) > 0}
        heure={preference?.heure ?? HEURE_PAR_DEFAUT}
        enService={palierHonoreLHeure()}
        abonner={abonnerAppareil}
        desabonner={desabonnerAppareil}
        choisirHeure={choisirHeure}
      />
    </main>
  );
}
