import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { lireAbonnement, eligibleAuRemboursement } from "@/lib/data/depot-resiliation";
import * as c from "@/render/abonnement/copie-abonnement";
import s from "./abonnement.module.css";

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

  const resiliationDemandee = abonnement?.resiliationDemandeeLe != null;
  const finAcces = dateFr(abonnement?.resiliationDemandeeLe ?? abonnement?.periodeFin ?? null);
  const actif = abonnement?.etat === "actif";
  // LA SORTIE NE DÉPEND PAS DE L'ÉTAT D'ACCÈS (revue du 2026-08-11, M12).
  //
  // Le geste était gardé par `actif`. Or un paiement en échec passe l'abonnement en `past_due` chez
  // Stripe, donc `etat = 'expire'` ici : l'écran affichait « Ton abonnement n'est plus actif » et
  // AUCUN bouton — pendant que Stripe poursuivait ses relances et finirait par encaisser. La
  // personne la plus coincée du produit était la seule sans porte.
  //
  // La 3.5 avait pourtant construit `abonnementGerable` exprès pour que le LIEN survive à cet
  // état (« quelqu'un coincé entre un accès fermé et un contrat ouvert »). Le lien était posé, la
  // destination oubliée. La route de résiliation, elle, n'a jamais demandé que le `subscriptionId`.
  const contratOuvert = abonnement?.subscriptionId != null;

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

      {/* ── L'ÉTAT ─────────────────────────────────────────────────────────────────────────────────── */}
      {!abonnement || (!actif && !resiliationDemandee) ? (
        <p className="t-corps">{c.ETAT_TERMINE}</p>
      ) : resiliationDemandee ? (
        <>
          <p className="t-corps">{c.ETAT_RESILIE}</p>
          {finAcces && <p className="t-meta">{c.ETAT_RESILIE_JUSQU_AU(finAcces)}</p>}
        </>
      ) : (
        <>
          <p className="t-corps">{c.ETAT_ACTIF}</p>
          {finAcces && <p className="t-meta">{c.ETAT_ACTIF_JUSQU_AU(finAcces)}</p>}
        </>
      )}

      {/* ── LE GESTE ───────────────────────────────────────────────────────────────────────────────── */}
      {resiliationDemandee ? (
        <form className={s.geste} method="post" action="/api/abonnement/resilier?reprendre=1">
          <button className="t-bouton" type="submit">
            {c.ACTION_REPRENDRE}
          </button>
        </form>
      ) : contratOuvert ? (
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
    </main>
  );
}
