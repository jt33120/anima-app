import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { HEURE_PAR_DEFAUT, HEURES_CHOISISSABLES, palierHonoreLHeure } from "@/lib/domain/socle-quotidien";
import * as copie from "@/lib/domain/copie-reglages";
import * as copieDonnees from "@/lib/domain/copie-mes-donnees";
import Reglages from "@/render/reglages/Reglages";
import s from "@/render/reglages/reglages.module.css";
import { abonnerAppareil, choisirHeure, desabonnerAppareil, reglerCourriels } from "./actions";
import PiedHalte from "@/render/PiedHalte";
import { piedPour, MENTION_IA, URL_AIDE, URL_TRANSPARENCE } from "@/lib/domain/pied-halte";

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
 * `abonneIci` est lu en base, pas dans le navigateur : la base est la source de vérité de ce que le
 * PRODUIT enverra, le navigateur celle de ce qu'il AFFICHERA.
 *
 * ⚠️ CE COMMENTAIRE DISAIT QUE LA DIVERGENCE ÉTAIT « ASSUMÉE ». Elle ne l'est plus, et la QA a eu
 * raison de le relever (tour 1, T11-quater) : après une réinitialisation de l'autorisation dans
 * Chrome, l'écran continuait d'afficher « Cet appareil reçoit le rythme quotidien. » — y compris
 * après rechargement. Pire, le seul bouton proposé était « Ne plus rien recevoir » : il fallait
 * DEMANDER À NE RIEN RECEVOIR pour retrouver un état permettant de se réabonner.
 *
 * L'îlot client rapproche désormais les deux sources au montage, en LECTURE SEULE — lire
 * `Notification.permission` ne demande rien et n'exige aucune activation. Ce que la page envoie
 * reste donc la vérité de la base ; ce que l'écran affiche est l'accord des deux.
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
  // ── LA GARDE D'ONBOARDING, QUI MANQUAIT (QA tour 1, T15) ─────────────────────────────────────
  //
  // Mesuré le 2026-08-15 : un compte neuf, qui n'avait rempli NI sa date de naissance NI le
  // consentement art. 9, atteignait cette page en tapant son adresse. Tout le reste redirigeait
  // correctement ; ces deux pages-ci passaient au travers. Une personne qui n'a consenti à rien
  // pouvait donc voir la page commerciale et les réglages.
  //
  // ⚠️ `revoque` N'EST PAS REDIRIGÉ, ET C'EST UNE DÉCISION. Quelqu'un qui a retiré son consentement
  // garde un abonnement à résilier et des droits à exercer ; l'enfermer sur l'écran de révocation
  // ferait de la sortie une impasse — soit exactement ce que FR-089 et la 3.5 refusent. Le
  // traitement art. 9 est suspendu par la base, pas par une redirection.
  const etape = await etapeOnboardingPour(supabase, user.id);
  if (etape === "barre") redirect("/barriere");
  if (etape === "mineur") {
    await supabase.auth.signOut();
    redirect("/entrer?refus=age");
  }
  if (etape === "naissance") redirect("/naissance");
  if (etape === "consentement") redirect("/consentement");


  // Deux lectures sous le JWT de l'utilisatrice, jamais `service_role` (AD-12). Les policies de 0053
  // ne lui montrent que ses propres lignes — c'est la base qui le garantit, pas ce fichier.
  const [{ data: preference }, { count }, { data: courriel }] = await Promise.all([
    supabase.from("preference_socle").select("heure").eq("utilisatrice_id", user.id).maybeSingle(),
    supabase.from("abonnement_poussee").select("id", { count: "exact", head: true }),
    // Revue Epic 6 (R7) : la policy de lecture propriétaire de 0034 suffit — pas de RPC pour LIRE.
    // La ligne peut ne pas exister (création paresseuse au premier envoi) : `maybeSingle` le dit sans
    // lever, et l'absence VEUT DIRE « elle reçoit », comme `refuse_le is null`.
    supabase
      .from("preference_courriel")
      .select("refuse_le")
      .eq("utilisatrice_id", user.id)
      .maybeSingle(),
  ]);
  const courrielsArretes = Boolean(courriel?.refuse_le);

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
          permissionSansReponse: copie.PERMISSION_SANS_REPONSE,
          autorisationRetiree: copie.AUTORISATION_RETIREE,
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
        // Le créneau diurne descend du MODÈLE (revue Epic 6, R3) : le composant proposait les 24
        // heures et décidait donc d'AD-17 à la place du domaine. La garde reste en base (0061).
        heures={HEURES_CHOISISSABLES}
        enService={palierHonoreLHeure()}
        abonner={abonnerAppareil}
        desabonner={desabonnerAppareil}
        choisirHeure={choisirHeure}
      />

      {/* ── LES COURRIELS D'ANAM (revue Epic 6, R7 · art. 21) ─────────────────────────────────
          Il n'existait AUCUN chemin dans l'application : le désabonnement (4.9) ne vivait que dans le
          lien d'un courriel déjà reçu. Sur un écran nommé « Réglages », dont le seul geste d'arrêt dit
          « Ne plus rien recevoir sur cet appareil », on laissait croire que tout s'arrêtait.

          FORMULAIRE NU, sans îlot client : il n'y a rien à charger pour exercer l'article 21, et un
          état client de plus serait un endroit de plus où l'écran peut mentir (leçon T11-quater).
          Aucune garde — ni art. 9, ni détresse : voir `reglerCourriels`. */}
      <section className={s.section} aria-labelledby="titre-courriels">
        <h2 id="titre-courriels" className={s.titre}>
          {copie.SECTION_COURRIELS}
        </h2>
        <p className={s.description}>{copie.DESCRIPTION_COURRIELS}</p>
        <p className={s.etat} data-testid="etat-courriels">
          {courrielsArretes ? copie.ETAT_COURRIELS_ARRETES : copie.ETAT_COURRIELS_RECUS}
        </p>
        <form
          action={async () => {
            "use server";
            await reglerCourriels(!courrielsArretes);
          }}
        >
          <button type="submit" className={s.bouton}>
            {courrielsArretes ? copie.REPRENDRE_COURRIELS : copie.ARRETER_COURRIELS}
          </button>
        </form>
        <p className={s.description}>{copie.COURRIELS_QUI_RESTENT}</p>
      </section>

      {/* Story 6.6 — le seul chemin cliquable vers « Mes données » tant que le menu de compte
          n'existe pas. `/reglages` est ce qui s'en approche le plus ; la dette du menu reste
          inscrite, commune aux sept haltes. */}
      <a className={s.lienHalte} href="/mes-donnees">
        {copieDonnees.TITRE_HALTE}
      </a>
      {/* Story 6.9 (QA T7) — la porte de secours (FR-077) et, là où elle est due, la mention
          IA (art. 50). Le MODÈLE décide ; ce composant dessine. */}
      <PiedHalte
        mentionIA={piedPour("reglages").mentionIA}
        texteMention={MENTION_IA}
        urlTransparence={URL_TRANSPARENCE}
        urlAide={URL_AIDE}
      />
    </main>
  );
}
