import s from "./conversation.module.css";
import {
  formaterPrixAnnuel,
  CADENCE_ABONNEMENT,
  TITRE_CARTE,
  GARANTIE_REMBOURSEMENT,
  RECONDUCTION,
  PERIMETRE_GRATUIT_TITRE,
  PERIMETRE_GRATUIT,
  PERIMETRE_PREMIUM_TITRE,
  PERIMETRE_PREMIUM,
  ACTION_ABONNER,
  ACTION_PAS_MAINTENANT,
} from "./offre-abonnement";

/**
 * CarteAbonnement — la carte d'abonnement DANS le fil, SOUS le bilan (Story 3.2, AC1-AC4). Composant
 * CLIENT présentationnel (le fil est client + éphémère, AD-8). MUET (AD-7) : il ne décide RIEN — le
 * SERVEUR a décidé de proposer (trame `paywall`). Registre SYSTÈME (jamais la voix d'Anam : Anam ne
 * vend rien, AC4) ; le prix et la copie viennent de `render/conversation/offre-abonnement` (pur, couplé au prix
 * facturé par test).
 *
 * ZÉRO DARK PATTERN (FR-061, AC2) : prix unique SANS barré, aucun compte à rebours, aucune rareté,
 * aucune urgence. Deux actions d'ÉGALE lisibilité — même rôle typo (`t-bouton`), même cible ≥ 44 px ;
 * la seule différence admise est la couleur de remplissage (primaire = accent). « M'abonner » = form
 * POST NATIF vers `/api/stripe/checkout` (3.1) → redirection 303 (robuste même sans JS). « Pas
 * maintenant » = vrai bouton (`onRefuser`) — une seule sollicitation (AC5).
 *
 * GARDE AD-9 : c'est le GATE SERVEUR (la trame `paywall` est RETENUE en détresse — pas de bilan → pas
 * de carte — et si premium) ; PAS la balise `<GardeCommerciale>`, impossible dans un fil client streamé.
 * Prouvé par tests/proposer-abonnement.test.ts (dérogation explicite dans tests/garde-commerciale.test.ts).
 *
 * `<article>` DANS le flux, JAMAIS une modale (AC1). Apparition en `fondu-texte` (opacité, neutralisée
 * sous reduced-motion) — « les choses paraissent », jamais un glissement. Même fiche que le bloc bilan.
 */
export default function CarteAbonnement({ onRefuser }: { onRefuser: () => void }) {
  return (
    <article className={`${s.bloc} fondu-texte`} aria-label="Proposition d’abonnement">
      <h2 className="t-titre-sm">{TITRE_CARTE}</h2>

      {/* Prix unique + garantie, sur la carte (AC2/AC3). Pas de prix barré. */}
      <p className={s.carteTarif}>
        <span className="t-titre">{formaterPrixAnnuel()}</span>
        <span className="t-meta">{CADENCE_ABONNEMENT}</span>
      </p>
      <p className={`${s.carteGarantie} t-meta`}>{GARANTIE_REMBOURSEMENT}</p>
      {/* Story 3.6 — la reconduction est dite là où l'argent est demandé (art. L215-1). Même registre
          que la garantie : `t-meta`, sur la carte, jamais reléguée aux CGU. */}
      <p className={`${s.carteGarantie} t-meta`}>{RECONDUCTION}</p>

      {/* Périmètre gratuit + premium sur la MÊME surface, registre système (AC4). */}
      <div className={s.cartePerimetres}>
        <section className={s.cartePerimetre}>
          <h3 className={`${s.cartePerimetreTitre} t-surtitre`}>{PERIMETRE_GRATUIT_TITRE}</h3>
          <ul className={s.blocListe}>
            {PERIMETRE_GRATUIT.map((ligne) => (
              <li key={ligne} className="t-corps">
                {ligne}
              </li>
            ))}
          </ul>
        </section>
        <section className={s.cartePerimetre}>
          <h3 className={`${s.cartePerimetreTitre} t-surtitre`}>{PERIMETRE_PREMIUM_TITRE}</h3>
          <ul className={s.blocListe}>
            {PERIMETRE_PREMIUM.map((ligne) => (
              <li key={ligne} className="t-corps">
                {ligne}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Deux actions d'ÉGALE lisibilité (AC2). Primaire = form POST natif → 303 Stripe. */}
      <div className={s.carteActions}>
        <form method="post" action="/api/stripe/checkout" className={s.carteActionForm}>
          <button type="submit" className={`${s.carteAction} ${s.carteActionPrimaire} t-bouton`}>
            {ACTION_ABONNER}
          </button>
        </form>
        <button type="button" onClick={onRefuser} className={`${s.carteAction} t-bouton`}>
          {ACTION_PAS_MAINTENANT}
        </button>
      </div>
    </article>
  );
}
