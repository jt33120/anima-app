"use client";

import type { CarteAnamVue } from "./types";
import s from "./accueil.module.css";

/**
 * CarteAnam.tsx — LA CARTE « ANAM » DE L'ACCUEIL (Story 6.3, T5 · AC6, AC7).
 *
 * ── LE RENDU NE DÉCIDE RIEN, ET ICI ÇA VEUT DIRE QUELQUE CHOSE DE PRÉCIS ─────────────────────────
 *
 * Il n'y a dans ce fichier ni condition sur un motif, ni date à formater, ni pluriel à accorder. Le
 * serveur a choisi le motif prioritaire, écrit la phrase et rogné ce qui dépassait
 * (`lib/domain/carte-anam.ts`). Le composant affiche une chaîne, ou n'affiche pas la ligne. C'est
 * exactement ce que `Bibliotheque.tsx` fait déjà, et pour la même raison (AD-7).
 *
 * ── AUCUNE PASTILLE — ET RIEN AVEC QUOI EN DESSINER UNE (FR-031, UX-DR-30) ───────────────────────
 *
 * Pas de `aria-live` : la carte n'annonce pas, elle est là. Pas de classe conditionnelle sur la
 * présence d'un motif — pas de `.aQuelqueChose`, pas d'accent qui s'allume, pas de point. La seule
 * différence visible entre « rien » et « quelque chose » est UNE LIGNE DE TEXTE EN PLUS, qui dit
 * elle-même de quoi il s'agit. Un accent qui s'allume serait un badge sans le mot.
 *
 * Et la carte est TOUJOURS rendue : la faire apparaître avec le motif reviendrait à dessiner la
 * pastille avec la carte entière.
 *
 * ── PAS DE « JE » (décision D5) ──────────────────────────────────────────────────────────────────
 *
 * La région Anam dit déjà « Il s'est passé quelque chose hier ». Deux voix pour un même événement,
 * dont l'une invente une intimité que l'autre évite, est un défaut de copie. Cette carte parle
 * D'ELLE, à la troisième personne, et laisse la conversation être la conversation.
 */

export interface ProprietesCarteAnam {
  readonly carte: CarteAnamVue;
}

export default function CarteAnam({ carte }: ProprietesCarteAnam) {
  return (
    <article className={`${s.carte} ${s.carteAnam}`} aria-labelledby="carte-anam-titre">
      {/* ⚠️ LA SIXIÈME CARTE, OUBLIÉE PAR LE PREMIER CORRECTIF (tour de QA 2, R1).
          Le 19 août au matin j'ai unifié les titres de `Bibliotheque.tsx` — quatre cartes — en
          croyant tenir la région. Elle en compte SIX : celle-ci vit dans un autre fichier, et
          elle est restée en `t-corps-fort` (Inter, 24 px, graisse 700). Résultat mesuré :
          après correction, ce titre était le SEUL sans empattement du produit — donc plus
          voyant qu'avant, pas moins. Un correctif partiel avait aggravé ce qu'il réparait.
          `tests/qa-visuelle-19-aout.test.ts` balaie maintenant TOUS les `<h2>` de `render/`. */}
      <h2 id="carte-anam-titre" className="t-titre-sm">
        {carte.titre}
      </h2>

      {/* La phrase invariante. Elle dit FR-034 en clair : sans elle, une carte sans ligne se lit
          comme une carte en panne, et la rareté d'Anam se lit comme un manque. */}
      <p className={`t-meta ${s.presenceAnam}`}>{carte.presence}</p>

      {/* EXACTEMENT UNE ligne, ou aucune. Dans la police d'Anam (`t-anam`) parce que ce qu'elle
          nomme vient d'elle — mais sans « je », et sans guillemets qui feraient une citation. */}
      {carte.ligne !== null && <p className="t-anam">{carte.ligne}</p>}
    </article>
  );
}
