import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { lireAbonnement, eligibleAuRemboursement, lireEtatRemboursement, type EtatRemboursement } from "@/lib/data/depot-resiliation";
import * as c from "@/render/abonnement/copie-abonnement";
import { MontagePaywall } from "@/app/_commerce/MontagePaywall";
import s from "./abonnement.module.css";
import PiedHalte from "@/render/PiedHalte";
import { piedPour, MENTION_IA, URL_AIDE, URL_TRANSPARENCE } from "@/lib/domain/pied-halte";
import { situationAbonnement } from "@/lib/domain/abonnement";

// NFR-015 — « Anam » partout, y compris ici : le titre paraît dans un onglet, potentiellement partagé.
export const metadata = { title: "Anam" };
export const dynamic = "force-dynamic";

/**
 * /abonnement — LA PORTE DE SORTIE (Story 3.5, FR-060 / loi du 16 août 2022).
 *
 * ── TROIS CLICS, ET LE COMPTE EST EXACT ─────────────────────────────────────────────────────────────────
 *
 *   1. « L'abonnement » dans la surimpression (présent dès qu'une souscription existe) ;
 *   2. « Résilier mon abonnement » ;
 *   3. « Oui, résilier » — la confirmation est SUR CETTE VUE, un seul bouton.
 *
 * La confirmation n'est pas un second écran et n'est pas une modale : c'est le même document, avec le
 * bouton remplacé. Un écran de plus ferait quatre clics, et quatre est illégal.
 *
 * ── SANS JAVASCRIPT ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Deux formulaires HTML qui POSTent vers les routes. Aucun `"use client"`, aucun état React, aucun
 * `onClick`. La porte de sortie ne dépend pas d'un script qui se charge : c'est la même exigence que la
 * porte de secours (FR-077), pour une raison différente mais aussi sérieuse.
 *
 * ── AUCUNE GARDE AD-9 ───────────────────────────────────────────────────────────────────────────────────
 *
 * Ni ici, ni sur les routes, ni sur le point d'entrée. Voir `app/api/abonnement/resilier/route.ts` et
 * `tests/sortie-abonnement.test.ts`. Cacher cette page pendant un épisode de détresse enfermerait
 * quelqu'un en crise dans un abonnement.
 */
export default async function PageAbonnement({
  searchParams,
}: {
  searchParams: Promise<{ etat?: string; confirmer?: string }>;
}) {
  const { etat: retour, confirmer } = await searchParams;

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


  let abonnement;
  let eligible = false;
  try {
    abonnement = await lireAbonnement();
    eligible = await eligibleAuRemboursement();
  } catch {
    // Une PANNE de lecture n'est pas « tu n'as pas d'abonnement » : le lui dire serait le mensonge que
    // la revue 4.6 a payé sur l'arbre. On le dit, et on ne propose aucun geste qu'on ne saurait tenir.
    return (
      <main className={s.page}>
        <h1 className="t-titre">{c.TITRE}</h1>
        <p className="t-corps">{c.ETAT_INDISPONIBLE}</p>
        <p className="t-meta">{c.ETAT_INDISPONIBLE_CORPS}</p>
      </main>
    );
  }

  // `timeZone` explicite (revue du 2026-08-11) : sans lui, la date est rendue dans le fuseau du
  // SERVEUR — UTC sur Vercel. Une échéance au 5 mars à 23 h 30 UTC est le 6 mars à Paris, et l'écran
  // annonçait alors la reconduction (art. L215-1) ou la fin d'accès un jour trop tôt. Même fuseau que
  // le reste du produit (`FUSEAU`, ordonnanceur).
  const dateFr = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("fr-FR", {
          timeZone: "Europe/Paris",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  // ⚠️ HORS DU `try` CI-DESSUS, ET DANS SON PROPRE `try` — pas un `.catch` sur l'appel. Deux raisons.
  // D'abord la portée : une panne de cette lecture-ci doit retirer la LIGNE d'état, jamais la page
  // (fermer la porte de sortie sur un timeout enfermerait quelqu'un dans un abonnement — leçon M12).
  // Ensuite la forme : `lireEtatRemboursement().catch(…)` ne rattrape qu'une promesse REJETÉE. Si
  // l'appel lui-même lève — module absent, symbole disparu — le `.catch` n'est jamais attaché, et
  // l'erreur remonte. C'est exactement ce qui s'est produit, et la page tombait en mode dégradé.
  let etatRemboursement: EtatRemboursement | null = null;
  try {
    // Le contrat COURANT (R3) : sinon l'écran affiche l'état d'un remboursement d'il y a un an.
    etatRemboursement = await lireEtatRemboursement(abonnement?.subscriptionId ?? null);
  } catch {
    etatRemboursement = null; // on ne dit rien plutôt que de dire faux — la page, elle, reste ouverte
  }

  // ⚠️ UNE SITUATION, PLUS TROIS BOOLÉENS (revue adversariale du 2026-08-18, R2).
  //
  // `actif`, `resiliationDemandee` et `contratOuvert` étaient recombinés dans QUATRE endroits de
  // cette page. Huit combinaisons, cinq écrites — et celle que Stripe envoie à CHAQUE échéance
  // (`etat = 'resilie'` AVEC `cancel_at` encore renseigné) n'était traitée nulle part. La page
  // annonçait alors un accès jusqu'à une date RÉVOLUE, n'offrait que « Reprendre » — refusé par
  // Stripe à tous les coups sur un contrat clos —, et taisait l'offre. Depuis la 3.6, cette page
  // est le seul chemin d'abonnement d'un compte sans branche : quiconque avait résilié une fois
  // ne pouvait plus jamais s'abonner.
  //
  // La dérivation vit dans `lib/domain` (AD-1) : elle est éprouvée sans monter la page, et la
  // route de résiliation lit LA MÊME — les deux ne peuvent plus diverger.
  const situation = situationAbonnement(abonnement);
  // L'ÉTAT DU REMBOURSEMENT, TANT QU'IL Y A QUELQUE CHOSE À DIRE (revue des Epics 1 à 4, #4). Le
  // retour d'action `?etat=rembourse` ne paraît qu'une fois ; ce qui suit vit sur la page.
  const messageRemboursement =
    etatRemboursement === "confirme"
      ? c.REMBOURSEMENT_CONFIRME
      : etatRemboursement === "echec"
        ? c.REMBOURSEMENT_ECHOUE
        : etatRemboursement === "en_cours"
          ? c.REMBOURSEMENT_EN_COURS
          : null;
  const finAcces = dateFr(abonnement?.resiliationDemandeeLe ?? abonnement?.periodeFin ?? null);
  // LA SORTIE NE DÉPEND PAS DE L'ÉTAT D'ACCÈS (revue du 2026-08-11, M12).
  //
  // Le geste était gardé par `actif`. Or un paiement en échec passe l'abonnement en `past_due` chez
  // Stripe, donc `etat = 'expire'` ici : l'écran affichait « Ton abonnement n'est plus actif » et
  // AUCUN bouton — pendant que Stripe poursuivait ses relances et finirait par encaisser. La
  // personne la plus coincée du produit était la seule sans porte. C'est la situation
  // `sans_acces_contrat_ouvert` : elle porte le geste, comme `actif`.
  // ⚠️ « OFFERT » N'EST NI L'UN NI L'AUTRE, ET LES DEUX ERREURS SONT VISIBLES. Rangé avec
  // `actif`, l'écran proposerait de résilier un contrat qui n'existe pas chez Stripe, et l'appel
  // partirait avec un identifiant nul. Rangé avec `jamais_abonnee`, il proposerait de payer pour
  // un accès déjà ouvert. Il ne porte donc NI le geste NI l'offre — et il le dit.
  const contratAResilier = situation === "actif" || situation === "sans_acces_contrat_ouvert";
  // L'OFFRE se monte partout où il n'y a PLUS de contrat vivant — y compris après une résiliation
  // aboutie (R2), et y compris sur un contrat coincé, que la route Checkout refusera avec une phrase
  // qui porte le chemin (`REFUS_CONTRAT_OUVERT`) plutôt qu'un mur.
  const offrable =
    situation !== "actif" && situation !== "resiliation_en_cours" && situation !== "offert";

  return (
    <main className={s.page}>
      <h1 className="t-titre">{c.TITRE}</h1>

      {/* Le retour d'une action, en toutes lettres. Aucune icône, aucune couleur seule (FR-031). */}
      {retour === "resilie" && <p className={`t-corps ${s.retour}`} role="status">{c.SUCCES_RESILIATION}</p>}
      {retour === "reprise" && <p className={`t-corps ${s.retour}`} role="status">{c.SUCCES_REPRISE}</p>}
      {retour === "rembourse" && <p className={`t-corps ${s.retour}`} role="status">{c.SUCCES_REMBOURSEMENT}</p>}
      {retour === "sans_paiement" && <p className={`t-corps ${s.retour}`} role="status">{c.REMBOURSEMENT_SANS_PAIEMENT}</p>}
      {retour === "non_eligible" && <p className={`t-corps ${s.retour}`} role="status">{c.REFUS_REMBOURSEMENT}</p>}
      {retour === "echec" && <p className={`t-corps ${s.retour}`} role="status">{c.ECHEC}</p>}
      {/* Le refus de l'ENTRÉE dans le paiement, en toutes lettres (revue 3.6, R1). La route Checkout
          redirige ici plutôt que de rendre un JSON : son POST vient d'un `<form>` sans JavaScript,
          donc un corps machine REMPLAÇAIT la page. La sortie avait déjà ce retour ; l'entrée non. */}
      {retour === "paiement_indisponible" && (
        <p className={`t-corps ${s.retour}`} role="status">
          {c.REFUS_PAIEMENT_INDISPONIBLE}
        </p>
      )}
      {/* Les deux autres refus d'entrée (revue des Epics 1 à 4, #16). Ils rendaient un corps JSON,
          que le navigateur affichait PLEIN ÉCRAN à la place de la page — le POST vient d'un
          formulaire sans JavaScript. `vente_fermee` sert à la fois le refus AD-9 et le refus
          d'état : nommer le premier motif écrirait l'épisode de détresse dans l'URL. */}
      {retour === "vente_fermee" && (
        <p className={`t-corps ${s.retour}`} role="status">
          {c.REFUS_VENTE_FERMEE}
        </p>
      )}
      {retour === "paiement_injoignable" && (
        <p className={`t-corps ${s.retour}`} role="status">
          {c.REFUS_PAIEMENT_INJOIGNABLE}
        </p>
      )}
      {/* L'ÉTAT DU REMBOURSEMENT — persistant, contrairement aux retours d'action ci-dessus. Il
          existe parce qu'un remboursement refusé par la banque était jeté sans trace pendant que
          l'écran avait promis un virement (revue des Epics 1 à 4, #4). */}
      {messageRemboursement && (
        <p className={`t-corps ${s.retour}`} role="status">
          {messageRemboursement}
        </p>
      )}
      {retour === "contrat_clos" && (
        <p className={`t-corps ${s.retour}`} role="status">
          {c.REFUS_CONTRAT_CLOS}
        </p>
      )}
      {/* Un onglet resté ouvert sur un compte à qui l'accès a été offert depuis. Il n'y a rien à
          résilier, et le lui dire vaut mieux qu'une page d'erreur. */}
      {retour === "rien_a_resilier" && (
        <p className={`t-corps ${s.retour}`} role="status">
          {c.REFUS_RIEN_A_RESILIER}
        </p>
      )}
      {retour === "contrat_ouvert" && (
        <p className={`t-corps ${s.retour}`} role="status">
          {c.REFUS_CONTRAT_OUVERT}
        </p>
      )}

      {/* ── L'ÉTAT ─────────────────────────────────────────────────────────────────────────────────── */}
      {/* ⚠️ STORY 3.6 (QA T2) — « jamais abonnée » et « abonnement terminé » lisaient la MÊME phrase.
          Un compte gratuit envoyé ici par `/ancrages` lisait « Ton abonnement n'est plus actif » à
          propos d'un abonnement qui n'a jamais existé — un état inventé, sur la page qui parle
          d'argent. Chaque situation a désormais sa phrase, et il n'en reste aucune sans nom (R2). */}
      {situation === "jamais_abonnee" ? (
        <p className="t-corps">{c.ETAT_JAMAIS_ABONNEE}</p>
      ) : situation === "offert" ? (
        <>
          <p className="t-corps">{c.ETAT_OFFERT}</p>
          <p className="t-meta">{c.ETAT_OFFERT_PRECISION}</p>
        </>
      ) : situation === "actif" ? (
        <>
          <p className="t-corps">{c.ETAT_ACTIF}</p>
          {finAcces && <p className="t-meta">{c.ETAT_ACTIF_JUSQU_AU(finAcces)}</p>}
        </>
      ) : situation === "resiliation_en_cours" ? (
        <>
          <p className="t-corps">{c.ETAT_RESILIE}</p>
          {finAcces && <p className="t-meta">{c.ETAT_RESILIE_JUSQU_AU(finAcces)}</p>}
        </>
      ) : (
        <>
          <p className="t-corps">{c.ETAT_TERMINE}</p>
          {/* ⚠️ LA DATE N'EST DITE QUE SI LE CONTRAT EST BIEN CLOS. Sur un contrat COINCÉ
              (`past_due` : accès éteint, relances en cours), « il s'est terminé le … » serait faux —
              et la `periode_fin` en base porterait une date parfaitement plausible. */}
          {situation === "termine" && finAcces && (
            <p className="t-meta">{c.ETAT_TERMINE_LE(finAcces)}</p>
          )}
        </>
      )}

      {/* ── LE GESTE ───────────────────────────────────────────────────────────────────────────────── */}
      {/* ⚠️ « REPRENDRE » NE PARAÎT QUE SI LE CONTRAT COURT ENCORE (R2). Sur un contrat clos, Stripe
          refuse `subscriptions.update` sans appel — « a canceled subscription can only update its
          metadata » — et la route rendait `?etat=echec` : « Tu peux réessayer », indéfiniment. */}
      {situation === "resiliation_en_cours" ? (
        <form className={s.geste} method="post" action="/api/abonnement/resilier?reprendre=1">
          <button className="t-bouton" type="submit">
            {c.ACTION_REPRENDRE}
          </button>
        </form>
      ) : contratAResilier ? (
        confirmer === "1" ? (
          // LA CONFIRMATION, SUR LA MÊME VUE, UN SEUL BOUTON (FR-060). Pas de « es-tu sûre ? », pas de
          // second écran, pas de champ « dis-nous pourquoi ». Le lien de retour n'est pas un bouton
          // concurrent mis en avant : c'est un retour discret, jamais une offre de rester.
          <form className={s.geste} method="post" action="/api/abonnement/resilier">
            <button className={`t-bouton ${s.confirmer}`} type="submit">
              {c.ACTION_RESILIER}
            </button>
            <p className="t-meta">{c.RIEN_NE_DISPARAIT}</p>
          </form>
        ) : (
          <p className={s.geste}>
            <a className="t-bouton" href="/abonnement?confirmer=1">
              {c.ACTION_RESILIER}
            </a>
          </p>
        )
      ) : null}

      {/* ── L'OFFRE (Story 3.6, QA T2) — LE SEUL CHEMIN D'ABONNEMENT D'UN COMPTE GRATUIT ──────────
          Le seul bouton de souscription du produit vivait sur la carte du fil, qui ne paraît qu'à un
          paywall. Or aucune branche n'est proposée à un compte gratuit (3.3, D2-A) : sans branche,
          pas de paywall, donc AUCUN chemin. Cette page était le cul-de-sac où `/ancrages` envoyait.

          ⚠️ ELLE EST GARDÉE, ET LE RESTE DE LA PAGE NE L'EST PAS — c'est la distinction centrale de
          la story. `/abonnement` refuse toute garde AD-9 parce que la SORTIE doit rester atteignable
          même en détresse (« enfermer quelqu'un en crise dans un abonnement »). Mais l'OFFRE est du
          commerce, et le commerce n'atteint pas quelqu'un en détresse (FR-043). Sortir n'est pas
          vendre : les deux gestes vivent sur la même page et n'ont pas le même régime. */}
      {/* ⚠️ `etape === "suite"` EST NOUVEAU, ET IL FERME UNE BOUCLE (revue des Epics 1 à 4, #16).
          Après les redirections ci-dessus, `etape` ne peut plus valoir que `suite` ou `revoque` —
          car un compte révoqué N'EST PAS redirigé, délibérément (il a un abonnement à résilier et
          des droits à exercer). Il voyait donc l'offre complète et le bouton « M'abonner », que la
          route de vente refuse ensuite systématiquement : un bouton qui ne peut pas marcher, sur la
          page qui parle d'argent. Montrer la sortie sans montrer l'entrée est exactement la
          distinction que cette page tient déjà. */}
      {etape === "suite" && offrable && (
        // `MontagePaywall` est la couture gardée POSÉE PAR LA 2.9 pour « une future surface paywall
        // rendue serveur » et restée inerte deux epics. C'est elle, ici. La garde AD-9 vit à
        // l'intérieur : la page ne décide rien, elle place.
        <MontagePaywall utilisatriceId={user.id} titre={c.TITRE_OFFRE} />
      )}

      {/* ── LA GARANTIE (FR-089) — proposée SEULEMENT quand elle y a droit ─────────────────────────── */}
      {eligible && retour !== "rembourse" && (
        <section className={s.garantie}>
          <p className="t-corps">{c.GARANTIE_DISPONIBLE}</p>
          <form method="post" action="/api/abonnement/remboursement">
            <button className="t-bouton" type="submit">
              {c.ACTION_REMBOURSEMENT}
            </button>
          </form>
        </section>
      )}
      {/* Story 6.9 (QA T7) — la porte de secours (FR-077) et, là où elle est due, la mention
          IA (art. 50). Le MODÈLE décide ; ce composant dessine. */}
      <PiedHalte
        mentionIA={piedPour("abonnement").mentionIA}
        texteMention={MENTION_IA}
        urlTransparence={URL_TRANSPARENCE}
        urlAide={URL_AIDE}
      />
    </main>
  );
}
