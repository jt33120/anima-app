"use client";

import type { CarteTireeVue } from "./types";
import { cheminVisuel, VISUELS_DESSINES } from "./visuels";
import s from "./lecture.module.css";

/**
 * CarteTiree.tsx — LA CARTE QUI PARAÎT (Story 5.7, T9 · AC5, AC8 · FR-022, NFR-016).
 *
 * ── CE COMPOSANT EST LIVRÉ ISOLÉ ───────────────────────────────────────────────────────────────
 *
 * Il n'est monté nulle part. Le rituel — Anam présente la carte, demande « qu'est-ce que tu vois ? »,
 * attend, puis construit la lecture — est la Story 5.8. Même choix qu'en 5.6 pour `TroncSeul` : la
 * pièce existe et est testée avant que la scène ne la place.
 *
 * ── CE QU'IL NE FAIT PAS, ET QUI EST LA MOITIÉ DE SA SPÉCIFICATION ────────────────────────────
 *
 * L'UX est explicite : « pas de retournement, pas de scintillement, pas de son, pas de mélange
 * animé — la théâtralisation suggérerait une magie que le produit ne revendique pas. La carte est
 * déjà là. » Il n'y a donc ici aucune animation, aucun état, aucun effet. Une seule carte, un dépôt
 * simple.
 *
 * Et il n'affiche NI le nom de la carte, NI aucune signification : le nom ne traverse que pour
 * désigner un fichier, et le sens ne traverse pas du tout (`./types.ts`).
 *
 * ── L'ABSENCE DITE PLUTÔT QUE MASQUÉE ─────────────────────────────────────────────────────────
 *
 * Tant que le visuel propriétaire n'est pas dessiné, la carte le dit. Un dos de carte générique ou
 * une silhouette d'emprunt seraient exactement ce que FR-022 refuse — un visuel non créé pour Anima,
 * affiché à la place d'un visuel d'Anima.
 */

export interface ProprietesCarteTiree {
  readonly carte: CarteTireeVue;
}

export default function CarteTiree({ carte }: ProprietesCarteTiree) {
  // Les deux conditions sont liées et non séparables : un visuel sans description écrite serait une
  // image sans texte alternatif utilisable. Voir `visuels.ts`.
  const dessine = VISUELS_DESSINES.has(carte.cle) && carte.description.statut === "ecrit";

  return (
    <figure className={s.carte}>
      {dessine && carte.description.statut === "ecrit" ? (
        // `alt` porte ce qui est DESSINÉ, jamais ce que ça veut dire (AC8). C'est le même contenu
        // que reçoit l'utilisatrice voyante par les yeux — la matière de sa projection, pas sa
        // lecture.
        <img className={s.visuel} src={cheminVisuel(carte.cle)} alt={carte.description.texte} />
      ) : (
        // `role="img"` + `aria-label` : le lecteur d'écran annonce l'absence au lieu de sauter un
        // trou silencieux. Ce qui est dit est ce qui est vrai — il n'y a pas encore d'image.
        <div className={s.nonDessine} role="img" aria-label="Le visuel de cette carte n'est pas encore dessiné.">
          <p className="t-meta">Le visuel de cette carte n&apos;est pas encore dessiné.</p>
        </div>
      )}
    </figure>
  );
}
