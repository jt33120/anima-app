/*
 * EtatVideArbre — L'ÉTAT VIDE DE L'ARBRE, en UN SEUL endroit (Story 3.3, AC2 [DUR]).
 *
 * ⚠️ POURQUOI CE COMPOSANT EXISTE. `VIDE_TITRE` / `VIDE_CORPS` étaient rendus par DEUX composants
 * (`ArbreInteractif` pour le canevas, `VueListe` pour le doublage non-spatial). Deux copies du même
 * écran, c'est deux endroits où ajouter un cadenas, un aperçu flouté ou un bandeau — et surtout un
 * endroit où l'oublier. AC2 exige que le vide d'un compte gratuit soit « le même vide » qu'un compte
 * premium sans branche : le rendre LITTÉRALEMENT par le même composant transforme cette exigence en
 * propriété structurelle, au lieu d'une coïncidence qu'il faudrait re-vérifier à chaque story.
 *
 * AD-7 — CE COMPOSANT NE DÉCIDE RIEN. Il reçoit un booléen déjà tranché par le modèle
 * (`doitDireOuNaissentLesBranches`, `lib/scene/projection.ts`) et dessine. Il ne connaît ni l'abonnement,
 * ni la fenêtre de détresse, ni le nombre de branches — il ne peut donc rien en dire.
 */

import { VIDE_TITRE, VIDE_CORPS, VIDE_OU_NAISSENT_LES_BRANCHES } from "./copie-arbre";
import BoutonTronc from "./BoutonTronc";
import TroncSeul from "./Tronc";
import s from "./arbre.module.css";

export interface ProprietesEtatVideArbre {
  /**
   * Story 3.3 (AC6) — la phrase sobre est-elle de mise ? Décidé SERVEUR/modèle, constaté ici.
   * Quatre conditions, toutes dans `doitDireOuNaissentLesBranches` : arbre vide, lecture réussie,
   * compte gratuit, aucun geste suspendu (AD-9).
   */
  direOuNaissentLesBranches?: boolean;
  /**
   * Story 5.3 — le chemin vers la fiche du tronc, quand il manque son heure. Il vit ICI parce que
   * l'écran vide REMPLACE le canevas : sans lui, la personne qui n'a encore aucune branche — c'est-à-dire
   * exactement celle qui n'a pas donné son heure — n'aurait aucun moyen d'atteindre la fiche.
   * Absent ⇒ rien ne s'affiche : un tronc complet n'a aucune affordance (AC4).
   */
  onOuvrirTronc?: () => void;
}

export default function EtatVideArbre({ direOuNaissentLesBranches, onOuvrirTronc }: ProprietesEtatVideArbre) {
  return (
    <div className={s.vide}>
      {/*
        Story 5.6 (T9) — LE TRONC EST DESSINÉ ICI AUSSI (FR-088, dette de la 3.3).

        Cet écran REMPLACE le canevas : sans ce dessin, la personne qui n'a encore aucune branche —
        c'est-à-dire tout le monde le premier jour — ne voyait jamais son tronc, alors que FR-088 dit
        « elle voit son tronc, y compris incomplet ». La 5.3 avait rendu sa FICHE atteignable, ce qui
        a masqué le manque : rien n'était inaccessible, seul le dessin était absent.

        `enReserve` est DÉRIVÉ de `onOuvrirTronc` plutôt que reçu à part, et c'est délibéré : le
        rappel n'existe que si le tronc est incomplet (voir la prop ci-dessus). Deux props séparées
        pourraient se contredire ; celle-ci ne le peut pas.
      */}
      <TroncSeul enReserve={Boolean(onOuvrirTronc)} />
      <p className={s.videTitre}>{VIDE_TITRE}</p>
      <p className={s.videCorps}>{VIDE_CORPS}</p>
      {/* Un `<p>` nu, dans le flux, sans bouton ni lien ni fermeture : la phrase n'est pas une bannière,
          elle fait partie de l'écran. Rien à cliquer, donc rien à refuser. */}
      {direOuNaissentLesBranches && <p className={s.videCorps}>{VIDE_OU_NAISSENT_LES_BRANCHES}</p>}
      {onOuvrirTronc && <BoutonTronc onOuvrir={onOuvrirTronc} />}
    </div>
  );
}
