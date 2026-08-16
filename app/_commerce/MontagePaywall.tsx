import "server-only"; // décision serveur (via GardeCommerciale → lib/safety) — jamais au client
import { GardeCommerciale } from "./GardeCommerciale";
import {
  formaterPrixAnnuel,
  CADENCE_ABONNEMENT,
  GARANTIE_REMBOURSEMENT,
  RECONDUCTION,
  PERIMETRE_GRATUIT_TITRE,
  PERIMETRE_GRATUIT,
  PERIMETRE_PREMIUM_TITRE,
  PERIMETRE_PREMIUM,
  ACTION_ABONNER,
} from "@/render/conversation/offre-abonnement";
import s from "./offre.module.css";

/**
 * MontagePaywall — LE POINT DE MONTAGE GARDÉ d'une surface commerciale rendue SERVEUR.
 *
 * Posé par la Story 2.9 (AC4) et resté INERTE deux epics durant, avec cette phrase dans son en-tête :
 * « RESTE la couture gardée pour une future surface paywall RENDUE SERVEUR (menu de compte, 3.3+) —
 * inerte tant que cette surface n'existe pas ». **La Story 3.6 est cette surface.** On remplit la
 * couture prévue plutôt que d'en ouvrir une seconde : deux points de montage commerciaux, c'est deux
 * endroits où oublier la garde.
 *
 * ══ LE DÉFAUT QUE CETTE SURFACE FERME (QA T2) ═══════════════════════════════════════════════════
 *
 * Le seul bouton de souscription du produit vivait sur `CarteAbonnement`, dans la conversation, et
 * n'apparaissait qu'au moment d'un paywall. Or aucune branche n'est jamais proposée à un compte
 * gratuit (3.3, D2-A) : **sans branche, pas de paywall, donc aucun chemin.** Quelqu'un qui voulait
 * s'abonner ne le pouvait pas. `/abonnement` — la seule page qui en parle — lui répondait « ton
 * abonnement n'est plus actif », à propos d'un abonnement qui n'a jamais existé.
 *
 * ══ ELLE N'INVENTE RIEN, ET C'EST LA CONDITION POUR QU'ELLE EXISTE ══════════════════════════════
 *
 * La note de suivi disait, à raison, que « le prix, le contenu de l'offre, la mention de reconduction
 * et la garantie se décident ensemble, et aucun des quatre n'est un choix de développeur ». Les
 * quatre étaient DÉJÀ décidés — trois par la 3.2 (prix couplé au prix FACTURÉ par test, périmètres,
 * garantie FR-089), le quatrième par la 3.5, dont tout le mécanisme d'information avant reconduction
 * existe. Cette surface les rassemble ; elle importe leur copie plutôt que de la recopier, parce que
 * deux exemplaires d'un prix divergent au premier ajustement et que l'un des deux devient un
 * mensonge commercial.
 *
 * ⚠️ SEULE LA PHRASE DE RECONDUCTION EST NOUVELLE, et c'était un manque LÉGAL : on demandait 69 €
 * sans dire nulle part que ce serait 69 € l'an prochain aussi (art. L215-1). Elle est posée dans la
 * source unique de la copie d'offre, donc elle paraît aussi sur la carte du fil.
 *
 * ══ POURQUOI ELLE EST GARDÉE ALORS QUE `/abonnement` NE L'EST PAS ═══════════════════════════════
 *
 * `/abonnement` refuse toute garde AD-9 depuis la 3.5, et pour une raison qu'on ne rouvre pas :
 * `limites_levees` est vrai pendant un épisode de détresse, donc la garder EMPÊCHERAIT DE RÉSILIER
 * quelqu'un en crise. **Sortir n'est pas du commerce. S'abonner l'est.** Les deux gestes vivent
 * désormais sur la même page et n'ont pas le même régime — c'est la distinction centrale de la story,
 * et elle est mesurée par `tests/offre-gardee.test.ts`.
 *
 * ══ ZÉRO DARK PATTERN (FR-061) ══════════════════════════════════════════════════════════════════
 *
 * Prix unique, aucun barré, aucun compte à rebours, aucune rareté. Le périmètre GRATUIT est écrit
 * AVANT le premium et avec la même lisibilité : quelqu'un qui repart sans s'abonner doit repartir en
 * sachant ce qu'il garde.
 */
export async function MontagePaywall({
  utilisatriceId,
  titre,
}: {
  utilisatriceId: string;
  titre: string;
}) {
  return (
    <GardeCommerciale utilisatriceId={utilisatriceId}>
      <section className={s.offre} aria-labelledby="offre_titre">
        <h2 id="offre_titre" className="t-titre-sm">
          {titre}
        </h2>

        <p className={s.tarif}>
          <span className="t-titre">{formaterPrixAnnuel()}</span>
          <span className="t-meta">{CADENCE_ABONNEMENT}</span>
        </p>
        <p className="t-meta">{GARANTIE_REMBOURSEMENT}</p>
        <p className="t-meta">{RECONDUCTION}</p>

        <div className={s.perimetres}>
          {/* Le GRATUIT d'abord : ce qu'elle garde si elle repart, avant ce qu'elle gagnerait. */}
          <section className={s.perimetre}>
            <h3 className="t-surtitre">{PERIMETRE_GRATUIT_TITRE}</h3>
            <ul className={s.liste}>
              {PERIMETRE_GRATUIT.map((l) => (
                <li key={l} className="t-corps">
                  {l}
                </li>
              ))}
            </ul>
          </section>
          <section className={s.perimetre}>
            <h3 className="t-surtitre">{PERIMETRE_PREMIUM_TITRE}</h3>
            <ul className={s.liste}>
              {PERIMETRE_PREMIUM.map((l) => (
                <li key={l} className="t-corps">
                  {l}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* POST NATIF, comme la carte du fil et comme la résiliation : la souscription ne dépend pas
            d'un script qui se charge. La route applique en plus sa propre garde AD-9 (3.1) — c'est
            la seconde couche, pas la première. */}
        <form method="post" action="/api/stripe/checkout">
          <button className={`t-bouton ${s.abonner}`} type="submit">
            {ACTION_ABONNER}
          </button>
        </form>
      </section>
    </GardeCommerciale>
  );
}
