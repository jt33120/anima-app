"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { IdRegion } from "@/lib/scene";
import s from "./guide.module.css";

/**
 * Guide.tsx — LE TOUR GUIDÉ (retour du 2026-08-20).
 *
 * « Le tutoriel doit me guider dans l'application, pas être juste une liste de texte, elle doit
 * mettre en évidence certaines parties, entourer, l'utilisateur clique sur suivant et on avance. »
 *
 * ── CE QUI FAIT QUE C'EST UN TOUR ET PAS UNE SUITE DE BOÎTES ───────────────────────────────────
 *
 *  1. il VA lui-même dans la région de l'étape (`onAller`), puis attend que l'écran s'y soit posé —
 *     désigner un élément pendant que la région se déplace pointerait un rectangle périmé ;
 *  2. il MESURE la cible à l'écran, à chaque étape et à chaque redimensionnement — un projecteur
 *     posé sur des coordonnées calculées une fois glisse à côté au premier défilement ;
 *  3. il SAUTE une étape dont la cible n'existe pas. Le contenu dépend du compte (un arbre vide n'a
 *     pas de branche) : une étape non résolue est un projecteur sur du vide, ce qui est pire que
 *     l'absence d'étape.
 *
 * ⚠️ AD-7 — IL NE DÉCIDE RIEN. Les étapes lui arrivent (`lib/domain/copie-guide.ts`), la navigation
 * est déléguée (`onAller`), la fin est signalée (`onFini`). Il mesure et il dessine.
 */

export interface EtapeGuideVue {
  readonly region: IdRegion;
  readonly cible: string | null;
  readonly titre: string;
  readonly texte: string;
}

export interface ProprietesGuide {
  readonly etapes: readonly EtapeGuideVue[];
  readonly libelles: {
    readonly suivant: string;
    readonly terminer: string;
    readonly quitter: string;
  };
  /** Aller dans une région — c'est la scène qui sait le faire, pas le guide. */
  readonly onAller: (region: IdRegion) => void;
  readonly onFini: () => void;
}

/** Le temps laissé à la région pour se poser avant de mesurer. Le fondu de région dure `--duree-longue`. */
const REPOS_REGION = 760;

interface Boite {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/** La boîte de la cible, ÉLARGIE d'un souffle : un projecteur collé au pixel étrangle l'élément. */
function mesurer(selecteur: string | null): Boite | null {
  if (!selecteur) return null;
  const el = document.querySelector(selecteur);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  /* ⚠️ ON BORNE LE RECTANGLE, PAS SES DIMENSIONS — et c'est une mesure sur écran large qui l'a
     exigé. Borner la LARGEUR revient à borner un seul côté : quand la cible touche déjà le bord
     gauche (le rail latéral en ≥ 1024 px, qui part de x = 0), la marge de gauche est mangée par le
     `max(0, …)` et celle de droite ne l'est pas — le projecteur déborde alors de 16 px d'un seul
     côté, et ne coïncide plus avec ce qu'il désigne. On calcule les quatre bords, puis la taille. */
  const marge = 8;
  const top = Math.max(0, r.top - marge);
  const left = Math.max(0, r.left - marge);
  const bas = Math.min(window.innerHeight, r.bottom + marge);
  const droite = Math.min(window.innerWidth, r.right + marge);
  return { top, left, width: droite - left, height: bas - top };
}

export default function Guide({ etapes, libelles, onAller, onFini }: ProprietesGuide) {
  const [rang, setRang] = useState(0);
  const [boite, setBoite] = useState<Boite | null>(null);
  const [pose, setPose] = useState(false);
  const [hauteurMesuree, setHauteurMesuree] = useState(232);
  const etape = etapes[rang];
  const bulleRef = useRef<HTMLDivElement | null>(null);

  const avancer = useCallback(() => {
    if (rang + 1 >= etapes.length) onFini();
    else setRang((r) => r + 1);
  }, [rang, etapes.length, onFini]);

  /* ── 1. ALLER, PUIS ATTENDRE ────────────────────────────────────────────────────────────────
     `pose` retombe à chaque étape : tant qu'il est faux, on ne mesure pas et on ne peint pas de
     projecteur. Sans lui, la première mesure a lieu pendant le fondu de région et désigne la
     position que l'élément occupait AVANT — c'est-à-dire à côté. */
  useEffect(() => {
    if (!etape) return;
    setPose(false);
    onAller(etape.region);
    const t = window.setTimeout(() => setPose(true), REPOS_REGION);
    return () => window.clearTimeout(t);
  }, [etape, onAller]);

  /* ── 2. MESURER, ET REMESURER ────────────────────────────────────────────────────────────────
     À chaque étape posée, puis à chaque redimensionnement et à chaque défilement : un projecteur
     est une position à l'écran, pas une propriété de l'élément. */
  useLayoutEffect(() => {
    if (!etape || !pose) return;
    const relever = () => setBoite(mesurer(etape.cible));
    relever();
    window.addEventListener("resize", relever);
    window.addEventListener("scroll", relever, true);
    return () => {
      window.removeEventListener("resize", relever);
      window.removeEventListener("scroll", relever, true);
    };
  }, [etape, pose]);

  /* ── 3. SAUTER CE QUI N'EXISTE PAS ───────────────────────────────────────────────────────────
     Une étape qui vise un élément absent (arbre vide, carte non rendue) est franchie sans bruit.
     Le tour ne s'arrête pas sur un compte dont le contenu diffère. */
  useEffect(() => {
    if (!etape || !pose) return;
    if (etape.cible && mesurer(etape.cible) === null) avancer();
  }, [etape, pose, avancer]);

  /* Le focus entre dans la bulle : au clavier comme au lecteur d'écran, le tour est là où l'on
     regarde. Échap quitte — une surimpression bloquante sans sortie au clavier est un piège. */
  useEffect(() => {
    bulleRef.current?.focus();
  }, [rang]);
  useLayoutEffect(() => {
    const h = bulleRef.current?.offsetHeight;
    if (h && h !== hauteurMesuree) setHauteurMesuree(h);
  });
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFini();
    };
    window.addEventListener("keydown", auClavier);
    return () => window.removeEventListener("keydown", auClavier);
  }, [onFini]);

  if (!etape) return null;

  /* La bulle se pose SOUS le projecteur s'il y a la place, au-dessus sinon, au centre s'il n'y a
     pas de cible. On ne recouvre jamais ce qu'on vient de désigner.
     ⚠️ SA HAUTEUR EST MESURÉE, PAS SUPPOSÉE. Une constante (232 px) marchait pour les étapes
     courtes et faisait chevaucher la bulle sur le projecteur dès qu'un texte passait à cinq lignes
     — mesuré sur « Ta barre », où la bulle recouvrait la barre qu'elle désignait. Le texte est de
     la copie : il changera, et une hauteur devinée redeviendra fausse sans prévenir. */
  const hauteurBulle = hauteurMesuree;
  const dessous = boite ? boite.top + boite.height + 16 : 0;
  const style: React.CSSProperties = !boite
    ? { top: "50%", transform: "translate(-50%, -50%)" }
    : dessous + hauteurBulle < window.innerHeight
      ? { top: dessous }
      : { top: Math.max(16, boite.top - hauteurBulle - 16) };

  const dernier = rang + 1 >= etapes.length;

  return (
    <div className={s.voile} role="presentation">
      {/* Les quatre volets qui bordent le trou. Sans cible, ils se réduisent à un seul plein écran :
          c'est le même objet, avec une fenêtre de taille nulle. */}
      {(
        boite
          ? [
              { top: 0, left: 0, width: "100vw", height: boite.top },
              { top: boite.top, left: 0, width: boite.left, height: boite.height },
              { top: boite.top, left: boite.left + boite.width, right: 0, height: boite.height },
              { top: boite.top + boite.height, left: 0, width: "100vw", bottom: 0 },
            ]
          : [{ top: 0, left: 0, width: "100vw", height: "100vh" }]
      ).map((v, i) => (
        <div key={i} className={s.volet} style={v as React.CSSProperties} aria-hidden />
      ))}
      <div
        className={`${s.trou} ${boite ? "" : s.trouAbsent}`}
        style={boite ? { top: boite.top, left: boite.left, width: boite.width, height: boite.height } : undefined}
        aria-hidden
      />
      <div
        className={s.bulle}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-titre"
        tabIndex={-1}
        ref={bulleRef}
      >
        <h2 id="guide-titre" className="t-titre-sm">
          {etape.titre}
        </h2>
        <p className="t-corps">{etape.texte}</p>
        <div className={s.pied}>
          {/* ⚠️ DES JALONS, JAMAIS « 3 / 6 ». Le produit n'affiche aucun compte (FR-031) ; ici il
              n'y a rien à compter, seulement à se situer. `aria-hidden` : la progression est déjà
              portée par le fait qu'on arrive au dernier bouton. */}
          <span className={s.jalons} aria-hidden>
            {etapes.map((_, i) => (
              <span key={i} className={`${s.jalon} ${i <= rang ? s.jalonFait : ""}`} />
            ))}
          </span>
          <button type="button" className={s.passer} onClick={onFini}>
            <span className="t-meta">{libelles.quitter}</span>
          </button>
          <button type="button" className={s.suivant} onClick={avancer}>
            <span className="t-bouton">{dernier ? libelles.terminer : libelles.suivant}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
