/**
 * Story 4.9 / revue T5-2 — LE JETON DE DÉSABONNEMENT, comme TYPE.
 *
 * Il vit dans le domaine et non dans `lib/courriel/` pour une raison précise : la garde d'architecture
 * AD-3 dit « aucun module hors du job de synthèse ne touche au canal courriel », et cette garde n'a de
 * valeur que si elle attrape ce qu'elle vise. Le dépôt a besoin de ce type pour rendre un jeton lu en
 * base ; s'il le prenait dans `lib/courriel/`, il compterait comme un utilisateur du canal, et la garde
 * devrait s'assouplir pour l'accueillir. Une garde qu'on élargit pour faire passer un cas est une garde
 * qui laissera passer le suivant.
 *
 * ── CE QUE LA MARQUE ACHÈTE ────────────────────────────────────────────────────────────────────────────
 *
 * `PortCourriel.envoyer` avait deux paramètres, aucun ne pouvant porter de texte — et c'était toute sa
 * sûreté : la phrase « ajoutons juste le premier paragraphe de la synthèse en aperçu » n'avait aucun
 * endroit où s'écrire. Le désabonnement en un clic est nécessairement PAR PERSONNE ; il a donc fallu
 * ouvrir un trou dans cette signature.
 *
 * `JetonDesabonnement` referme le trou : seule `jetonValide` produit ce type, et elle n'accepte qu'un
 * uuid. La vérification est à l'EXÉCUTION et pas seulement à la compilation — sans quoi un `as` suffirait
 * à rouvrir le trou, et un `as` est exactement ce qu'écrit quelqu'un de pressé.
 */

declare const marqueJeton: unique symbol;
export type JetonDesabonnement = string & { readonly [marqueJeton]: true };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La SEULE porte d'entrée du type marqué. `null` sur tout ce qui n'est pas un uuid. */
export function jetonValide(brut: string | null | undefined): JetonDesabonnement | null {
  const propre = (brut ?? "").trim();
  return UUID.test(propre) ? (propre as JetonDesabonnement) : null;
}
