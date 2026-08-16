import Link from "next/link";
import s from "./pied-halte.module.css";

/**
 * PiedHalte — LE BAS D'UNE HALTE (Story 6.9, QA T7). Rendu MUET (AD-7).
 *
 * Il CONSOMME ce que `lib/domain/pied-halte.ts` a décidé et le dessine. Il ne dérive rien : ni la
 * présence de la mention IA, ni son texte, ni sa cible.
 *
 * ── POURQUOI CE N'EST PAS UNE SURIMPRESSION ────────────────────────────────────────────────────
 *
 * Sur la scène, la porte de secours FLOTTE en haut, dans un voile, parce que la scène est un monde
 * continu sans bords et qu'une barre y serait un corps étranger. Une halte, elle, est un document :
 * elle a un début et une fin, on la lit de haut en bas, et le bas d'un document est exactement là
 * où l'on met ce qui vaut pour tout ce qui précède.
 *
 * ⚠️ CE N'EST PAS POUR AUTANT UN « FOOTER » DE SITE. Deux liens, aucun logo, aucun plan du site,
 * aucune newsletter, aucun réseau social. Ce qui est là est là pour une raison nommée : FR-077 pour
 * l'un, l'art. 50 de l'AI Act pour l'autre.
 *
 * ── LA PORTE DE SECOURS EST LE DERNIER ARRÊT DE TABULATION ─────────────────────────────────────
 *
 * Même ordre que la surimpression : la mention d'abord, la porte ensuite. Elle ne cède sa place à
 * rien, et rien ne se glisse après elle.
 */
export default function PiedHalte({
  mentionIA,
  texteMention,
  urlTransparence,
  urlAide,
}: {
  readonly mentionIA: boolean;
  readonly texteMention: string;
  readonly urlTransparence: string;
  readonly urlAide: string;
}) {
  return (
    <footer className={s.pied}>
      {mentionIA && (
        <Link className={s.lien} href={urlTransparence}>
          <span className="t-meta">{texteMention}</span>
        </Link>
      )}
      {/* Toujours présente, sur toutes les haltes, indépendante de toute détection (FR-077). */}
      <Link className={s.lien} href={urlAide}>
        <span className="t-meta">Aide</span>
      </Link>
    </footer>
  );
}
