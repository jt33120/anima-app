"use client";

import { useState } from "react";
import s from "./conversation.module.css";

/**
 * ImageAnam — le système d'assets du personnage (Story 2.2, B5 ; UX-DR-15, AC9). Sert les TROIS
 * formats en WebP/AVIF + repli PNG, @2x, `loading="lazy"`, `alt` SOBRE non-révélateur. Chemins
 * stables sous `public/scene/<format>/anam-<format>.{avif,webp,png}`.
 *
 * REPLI GRACIEUX (AC9) : tant que l'asset peint n'existe pas (Phase C, production Gemini), une
 * présence PLUMEUSE en CSS pur s'affiche — jamais d'image cassée, le build ne casse pas. Le sens
 * est porté par `role="img"` + `aria-label` sur l'enveloppe (valable dans les DEUX cas) ; l'`<img>`
 * interne est donc décoratif (`alt=""`) pour ne pas doubler l'annonce.
 *
 * Le personnage n'apparaît JAMAIS dans l'icône, l'aperçu de notification ni la vignette multitâche
 * (ce composant n'est utilisé que dans la scène ; `app/icon.svg` reste un fragment abstrait).
 */

export type FormatAnam = "seuil" | "presence" | "veille";

export default function ImageAnam({
  format,
  alt,
  className,
}: {
  format: FormatAnam;
  alt: string;
  className?: string;
}) {
  const [absent, setAbsent] = useState(false);
  const base = `/scene/${format}/anam-${format}`;

  return (
    <span
      className={`${s.imageAnam} ${s[format]} ${className ?? ""}`}
      role="img"
      aria-label={alt}
    >
      {/* Les assets sont des PNG DÉTOURÉS (fond transparent) : le repli plumeux ne s'affiche QUE si
          l'image manque (sinon il transparaîtrait à travers l'alpha = halo indésirable, revue). */}
      {absent ? (
        <span className={s.imageAnamRepli} aria-hidden />
      ) : (
        <picture>
          <source type="image/avif" srcSet={`${base}.avif 1x, ${base}@2x.avif 2x`} />
          <source type="image/webp" srcSet={`${base}.webp 1x, ${base}@2x.webp 2x`} />
          {/* <picture> multi-format pré-encodé (WebP/AVIF + repli PNG, @2x) : next/image ferait de
              l'optimisation runtime, pas le repli 3-formats pré-généré voulu par AC9. */}
          <img
            src={`${base}.png`}
            srcSet={`${base}@2x.png 2x`}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setAbsent(true)}
            className={s.imageAnamImg}
          />
        </picture>
      )}
    </span>
  );
}
