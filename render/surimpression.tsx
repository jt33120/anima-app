"use client";

/*
 * surimpression.tsx — La SURIMPRESSION PERSISTANTE (Story 1.8). Rendu MUET (AD-7) : il
 * CONSOMME le modèle `Surimpression` (lib/scene) et le dessine ; il ne décide RIEN — c'est
 * le modèle qui tranche *quoi* porter selon la région (règle légale FR-013 + sécurité AD-9).
 *
 * Présence flottante, SANS BORD ni fond barré : sa lisibilité tient au VOILE (même mécanisme
 * que .voile-seuil, orienté vers le bas), jamais à une barre. Porte, dans l'ordre : signe
 * d'Anam, mention IA, porte de secours. La porte de secours est TOUJOURS là ; le signe et la
 * mention n'apparaissent qu'en conversation. Aucune animation : le contenu change
 * INSTANTANÉMENT avec la région → jamais « dissous » au défilement (AC1/AC6).
 *
 * Tabulation (AC3) : rendue en TÊTE de la scène et hors de tout `inert` → la mention (si
 * présente) puis la porte de secours sont les tout premiers arrêts (au plus 2 pour « Aide »).
 */

import Link from "next/link";
import {
  URL_AIDE,
  URL_ABONNEMENT,
  MENTION_IA,
  URL_TRANSPARENCE,
  type Surimpression,
} from "@/lib/scene";
import s from "./monde.module.css";

/**
 * Fragment abstrait tronc/branche — PLACEHOLDER du signe d'Anam (l'asset peint final viendra).
 * Décoratif (`aria-hidden`) : la transparence est portée par la mention IA (texte + lien), pas
 * par le glyphe. « Anam prépare » (Story 2.2, AC2) : le trait S'ÉPAISSIT (attribut statique piloté
 * par `prepare`), SANS animation cyclique — jamais trois points qui rebondissent.
 */
function SigneAnam({ prepare }: { prepare: boolean }) {
  return (
    <svg
      className={`${s.signeAnam} ${prepare ? s.signeAnamPrepare : ""}`}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path d="M12 22 V7" />
      <path d="M12 12.5 L7 8.5" />
      <path d="M12 14.5 L17 9.5" />
    </svg>
  );
}

export default function Surimpression({
  modele,
  prepare = false,
}: {
  modele: Surimpression;
  prepare?: boolean;
}) {
  return (
    <div className={s.surimpression}>
      {/* Le voile : dense là où flotte le texte, se dissout vers le bas. Pas une bande. */}
      <div className={s.surimpressionVoile} aria-hidden />

      {modele.signeAnam && <SigneAnam prepare={prepare} />}

      {modele.mentionIA && (
        <Link className={s.mentionIa} href={URL_TRANSPARENCE}>
          <span className="t-meta">{MENTION_IA}</span>
        </Link>
      )}

      {/* Story 3.5 (FR-060) — LA SORTIE. Même registre visuel que « Aide » : `t-meta`, flottant dans le
          voile, aucun fond, aucun bord, aucune animation. Ce n'est pas une barre, et ça ne doit pas le
          devenir. Le MODÈLE décide de sa présence (AD-7) : ce composant ne dérive rien, il dessine.
          Placé AVANT la porte de secours pour que « Aide » reste le dernier arrêt de tabulation le plus
          à droite — la porte de secours ne cède sa place à rien. */}
      {modele.cheminAbonnement && (
        <Link className={s.cheminAbonnement} href={URL_ABONNEMENT}>
          <span className="t-meta">L&apos;abonnement</span>
        </Link>
      )}

      {/* Toujours présente, alignée à droite, indépendante de toute détection (FR-077). */}
      <Link className={s.porteSecours} href={URL_AIDE}>
        <span className="t-meta">Aide</span>
      </Link>
    </div>
  );
}
