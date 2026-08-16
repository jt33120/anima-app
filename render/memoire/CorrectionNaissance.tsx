"use client";

import { useState } from "react";
import s from "./memoire.module.css";

/**
 * L'ÎLOT CLIENT DE « TON HEURE DE NAISSANCE » (Story 6.5b — seconde section de `/memoire`).
 *
 * ── AUCUN TEXTE N'EST ÉCRIT ICI ────────────────────────────────────────────────────────────────
 *
 * `render/` est un ADAPTATEUR MUET (AD-7) et n'importe jamais `lib/domain` : la copie descend de la
 * page, y compris les phrases de l'aperçu, qui sont calculées côté serveur. Ce composant ne sait
 * même pas ce qu'est un ascendant.
 *
 * ── DEUX TEMPS, ET C'EST LA STORY ENTIÈRE ──────────────────────────────────────────────────────
 *
 * La correction n'est pas plafonnée (RGPD art. 16 ne s'épuise pas au premier usage). Ce qui la rend
 * sûre n'est donc pas un compteur, c'est le fait qu'elle ne soit JAMAIS AVEUGLE : on demande d'abord
 * l'heure, on montre ce qu'elle change, et on écrit seulement après un second geste.
 *
 * ⚠️ QUI SUPPRIMERAIT L'ÉTAPE D'APERÇU POUR « SIMPLIFIER » retirerait la seule chose qui remplace le
 * plafond. Le formulaire redeviendrait un champ qu'on remplit distraitement — sur la donnée d'où
 * dérive tout le socle.
 */

export interface CopieCorrection {
  readonly titre: string;
  readonly introduction: string;
  readonly heureAbsente: string;
  readonly lienAjouter: string;
  readonly etiquette: string;
  readonly aide: string;
  readonly voir: string;
  readonly confirmer: string;
  readonly renoncer: string;
  readonly corrige: string;
  readonly dejaCorrigee: string | null;
  readonly refusRevocation: string | null;
}

/**
 * Les réponses des deux Server Actions, décrites STRUCTURELLEMENT.
 *
 * ⚠️ `render/` ne peut pas importer les types de `lib/domain` ni de `app/` (AD-7). On les redéclare
 * donc ici, et c'est `tsc` qui vérifie qu'ils coïncident au moment où la page câble les actions —
 * une divergence ne peut pas passer silencieusement.
 */
export type ReponseApercu =
  | { readonly statut: "apercu"; readonly heure: string; readonly phrases: readonly string[] }
  | { readonly statut: "erreur"; readonly message: string };

export type ReponseEcriture =
  | { readonly statut: "ok" }
  | { readonly statut: "erreur"; readonly message: string };

export default function CorrectionNaissance({
  copie,
  heureActuelle,
  apercevoir,
  confirmer,
}: {
  readonly copie: CopieCorrection;
  /** `HH:MM` déjà enregistrée, ou `null` : il n'y a alors rien à corriger. */
  readonly heureActuelle: string | null;
  readonly apercevoir: (heure: string) => Promise<ReponseApercu>;
  readonly confirmer: (heure: string) => Promise<ReponseEcriture>;
}) {
  const [saisie, setSaisie] = useState("");
  const [apercu, setApercu] = useState<{ heure: string; phrases: readonly string[] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const section = (contenu: React.ReactNode) => (
    <section className={s.section} aria-labelledby="correction_titre">
      <h2 id="correction_titre" className={s.titreSection}>
        {copie.titre}
      </h2>
      {contenu}
    </section>
  );

  // Rien à corriger : on ne montre pas un champ vide qui n'écrirait nulle part, on renvoie là où
  // l'ajout se fait (5.3). Une question sans issue est un reproche — la leçon de la 4.10.
  if (heureActuelle === null) {
    return section(
      <>
        <p className={s.introduction}>{copie.heureAbsente}</p>
        <a className={s.bouton} href="/heure-naissance">
          <span className="t-bouton">{copie.lienAjouter}</span>
        </a>
      </>,
    );
  }

  // Le consentement a été retiré : le thème ne peut plus être regravé, donc corriger ne changerait
  // rien. Annoncé D'AVANCE, jamais après un envoi — même geste que la section voisine.
  if (copie.refusRevocation !== null) {
    return section(<p className={s.refus}>{copie.refusRevocation}</p>);
  }

  if (fait) {
    return section(
      <p className={s.introduction} role="status">
        {copie.corrige}
      </p>,
    );
  }

  const demanderApercu = async () => {
    setEnCours(true);
    setErreur(null);
    const r = await apercevoir(saisie);
    setEnCours(false);
    if (r.statut === "erreur") {
      setApercu(null);
      setErreur(r.message);
      return;
    }
    setApercu({ heure: r.heure, phrases: r.phrases });
  };

  const envoyer = async () => {
    if (!apercu) return;
    setEnCours(true);
    setErreur(null);
    // ⚠️ On envoie l'heure DE L'APERÇU, pas celle du champ. Sans ça, modifier le champ après avoir
    // regardé l'aperçu ferait écrire une heure dont elle n'a jamais vu les conséquences — c'est-à-dire
    // exactement le geste aveugle que cette étape existe pour empêcher.
    const r = await confirmer(apercu.heure);
    setEnCours(false);
    if (r.statut === "erreur") {
      setErreur(r.message);
      return;
    }
    setFait(true);
  };

  return section(
    <>
      <p className={s.introduction}>{copie.introduction}</p>
      {copie.dejaCorrigee !== null && <p className={s.meta}>{copie.dejaCorrigee}</p>}

      <p className={s.meta}>Heure enregistrée : {heureActuelle}</p>

      {/* ⚠️ L'AIDE EST HORS DU `<label>`, ET C'EST UNE CORRECTION D'ACCESSIBILITÉ, PAS UNE MISE EN
          PAGE. À l'intérieur, elle entre dans le NOM ACCESSIBLE du champ : un lecteur d'écran
          annoncerait « La bonne heure Telle qu'elle est écrite sur ta copie intégrale… » comme
          étiquette. Elle est rattachée par `aria-describedby`, qui est fait pour ça. */}
      <label htmlFor="heure_corrigee" className={s.etiquette}>
        <span className="t-meta">{copie.etiquette}</span>
        <input
          id="heure_corrigee"
          name="heure_corrigee"
          type="time"
          className={s.champ}
          value={saisie}
          aria-describedby="heure_corrigee_aide"
          onChange={(e) => {
            setSaisie(e.target.value);
            // Le champ a bougé : l'aperçu affiché ne décrit plus ce qui partirait. On l'efface
            // plutôt que de le laisser mentir d'un cran.
            setApercu(null);
          }}
        />
      </label>
      <span id="heure_corrigee_aide" className={s.meta}>
        {copie.aide}
      </span>

      {apercu !== null && (
        <ul className={s.apercu} role="status">
          {apercu.phrases.map((p) => (
            <li key={p} className="t-corps">
              {p}
            </li>
          ))}
        </ul>
      )}

      {erreur !== null && (
        <p className={s.refus} role="alert">
          {erreur}
        </p>
      )}

      <div className={s.actions}>
        {apercu === null ? (
          <button
            type="button"
            className={s.bouton}
            disabled={enCours || saisie.trim() === ""}
            onClick={demanderApercu}
          >
            <span className="t-bouton">{enCours ? "…" : copie.voir}</span>
          </button>
        ) : (
          <>
            <button type="button" className={s.bouton} disabled={enCours} onClick={envoyer}>
              <span className="t-bouton">{enCours ? "…" : copie.confirmer}</span>
            </button>
            <button
              type="button"
              className={s.bouton}
              disabled={enCours}
              onClick={() => {
                setApercu(null);
                setSaisie("");
              }}
            >
              <span className="t-bouton">{copie.renoncer}</span>
            </button>
          </>
        )}
      </div>
    </>,
  );
}
