"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { effacerType, recommencerTest } from "./actions";
import s from "./enneagramme.module.css";

/**
 * resultat.tsx — LE TYPE RETENU (Story 5.5, AC1/AC3).
 *
 * ── UN TYPE, JAMAIS UN SCORE ──────────────────────────────────────────────────────────────────
 *
 * Aucun nombre de points, aucun classement, aucun « 4 avec une aile 5 à 78 % » (FR-031). Le serveur
 * a scoré, il a choisi, et le score n'a pas franchi la frontière : cet écran n'a jamais reçu de
 * total. Il ne peut donc pas en afficher un.
 *
 * ── LE TEXTE VIENT D'ANIMA, OU N'EXISTE PAS ENCORE — ET ON LE DIT ─────────────────────────────
 *
 * `TexteCorpus` n'a que deux états, `ecrit` et `non_ecrit` (FR-054/FR-086) : il n'existe pas de
 * « texte par défaut », et c'est délibéré — ce serait la porte par laquelle un texte sans auteur
 * entrerait, avec exactement l'air d'un texte d'Anima. Tant que le créneau est vide, l'écran dit
 * honnêtement qu'il est vide, dans la voix du PRODUIT (`t-corps`), jamais dans celle d'Anam.
 *
 * ── ET ELLE PEUT DÉFAIRE ──────────────────────────────────────────────────────────────────────
 *
 * Refaire le test et effacer son type sont là, visibles, sans confirmation solennelle : ce geste-ci
 * n'a rien d'irréversible (contrairement à l'heure de naissance, write-once). Les deux restent
 * ouverts même après révocation du consentement — retirer une étiquette n'est pas en déposer une
 * (0049, AC6). Une étiquette qu'on ne peut pas retirer n'est pas une hypothèse, c'est un verdict.
 */

export default function Resultat({
  type,
  origine,
  texte,
  messageSansTexte,
}: {
  type: number;
  origine: "test" | "hypothese";
  /** Le texte d'Anima, ou `null` si le créneau n'est pas encore écrit. */
  texte: string | null;
  /** La phrase du PRODUIT quand le créneau est vide. Servie par le serveur, jamais composée ici. */
  messageSansTexte: string;
}) {
  const router = useRouter();
  const verrou = useRef(false);
  const [envoi, setEnvoi] = useState(false);

  /**
   * ⚠️ « REFAIRE » N'EFFACE PAS SON TYPE D'ABORD. Le réflexe serait de repartir d'une page blanche —
   * et il la laisserait SANS TYPE si elle abandonne le test au huitième énoncé. On efface seulement
   * la passe en cours (pour que la `key` change et que rien ne fuie de l'ancienne), et le type reste
   * en place jusqu'à ce qu'un nouveau le remplace. `terminer_tentative_enneagramme` écrase.
   */
  async function agir(quoi: () => Promise<void>, versLeTest = false) {
    if (verrou.current) return;
    verrou.current = true;
    setEnvoi(true);
    try {
      await quoi();
      if (versLeTest) router.push("/enneagramme?refaire=1");
      else router.refresh();
    } finally {
      verrou.current = false;
      setEnvoi(false);
    }
  }

  return (
    <section className={`${s.bloc} fondu-texte`} aria-label="Ton type">
      <p className={`${s.type} t-titre`}>Type {type}</p>
      <p className="t-corps">
        {origine === "test"
          ? "C'est ce qui ressort de tes réponses."
          : "C'est l'idée d'Anam, que tu as reconnue."}
      </p>
      {/* Le texte d'Anima quand il existe — dans SA voix. Le message d'absence, lui, est du produit :
          `t-corps`, jamais `t-anam`. Confondre les deux ferait parler Anima à sa place. */}
      {texte !== null ? (
        <p className="t-anam">{texte}</p>
      ) : (
        <p className="t-corps">{messageSansTexte}</p>
      )}
      <div className={s.gestes}>
        <button
          type="button"
          className={s.discret}
          disabled={envoi}
          onClick={() => agir(recommencerTest, true)}
        >
          <span className="t-bouton">Refaire le test</span>
        </button>
        <button type="button" className={s.discret} disabled={envoi} onClick={() => agir(effacerType)}>
          <span className="t-bouton">Effacer</span>
        </button>
      </div>
    </section>
  );
}
