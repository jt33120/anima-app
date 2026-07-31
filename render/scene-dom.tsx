"use client";

/*
 * scene-dom.tsx — L'ADAPTATEUR de rendu DOM/2D (AD-7). SEUL hôte du view-state, via
 * useReducer(reducteurVue). Il CONSOMME le modèle (lib/scene) et le dessine ; il ne
 * DÉCIDE rien — aucune monotonie, aucune règle métier. Un futur adaptateur WebGL
 * implémentera le même contrat de props (ProprietesSceneRendue) sans toucher au modèle.
 *
 * Dépendance : render/ → lib/scene/ uniquement (jamais l'inverse — AD-10). Aucun secret,
 * aucun accès base, aucune variable d'environnement ici (frontière serveur = app/, AC6).
 */

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  REGIONS,
  etatInitial,
  reducteurVue,
  surimpressionPour,
  type IdRegion,
  type ProjectionScene,
} from "@/lib/scene";
import ArbreVivant from "./arbre-vivant";
import Surimpression from "./surimpression";
import Conversation from "./conversation/Conversation";
import type { PropositionBrancheData } from "./conversation/types";
import s from "./monde.module.css";

export interface ProprietesSceneRendue {
  /** Domain-projection serveur, en lecture seule (AD-7). Le rendu ne l'écrit jamais. */
  projection: ProjectionScene;
  /** Story 4.5 — proposition de branche « le lendemain » calculée serveur (générique, aucun art. 9), ou null. */
  propositionBranche?: PropositionBrancheData | null;
}

/* Étoiles générées côté client APRÈS montage → aucun décalage d'hydratation. */
function Etoiles() {
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);

  const etoiles = useMemo(() => {
    if (!monte) return [];
    return Array.from({ length: 80 }, () => ({
      top: Math.random() * 100,
      left: Math.random() * 100,
      taille: 1 + Math.random() * 2.2,
      retard: Math.random() * 4200,
      duree: 3200 + Math.random() * 3000,
    }));
  }, [monte]);

  if (!monte) return null;
  return (
    <div className={s.etoiles} aria-hidden>
      {etoiles.map((e, i) => (
        <span
          key={i}
          className={s.etoile}
          style={
            {
              top: `${e.top}%`,
              left: `${e.left}%`,
              width: `${e.taille}px`,
              height: `${e.taille}px`,
              "--retard": `${e.retard}ms`,
              "--duree-etoile": `${e.duree}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/**
 * Contenu PLACEHOLDER sobre par destination (le contenu réel = epics 2/4/5).
 * L'ORDRE et les LIBELLÉS viennent du modèle (REGIONS) ; ici, seule la copie
 * placeholder — présentation, pas logique métier — est indexée par id.
 */
const CORPS: Record<IdRegion, string> = {
  seuil: "",
  accueil: "La bibliothèque de tes repères prendra place ici.",
  anam: "", // la région anam rend <Conversation/>, jamais ce placeholder (Story 2.2)
  arbre: "Ton arbre grandira à mesure que tu avances.",
};

export default function SceneDom({ projection, propositionBranche }: ProprietesSceneRendue) {
  const [etat, dispatch] = useReducer(reducteurVue, etatInitial);
  const region = etat.regionCourante;
  const aller = (cible: IdRegion) => dispatch({ type: "aller", cible });

  // État « Anam prépare » (AC2) remonté de la conversation → épaissit le signe de la surimpression.
  // Présentation pure (pas de domaine) ; SceneDom, hôte du view-state, le porte (AD-7).
  const [anamPrepare, setAnamPrepare] = useState(false);

  // Focus déplacé vers l'entête de la région ACTIVÉE (AC3), jamais au montage initial.
  // On compare à la région précédente (robuste au double-montage de React StrictMode,
  // contrairement à un simple booléen « déjà monté »).
  const entetes = useRef<Partial<Record<IdRegion, HTMLElement | null>>>({});
  const regionPrec = useRef<IdRegion>(region);
  useEffect(() => {
    if (regionPrec.current !== region) {
      entetes.current[region]?.focus();
      regionPrec.current = region;
    }
  }, [region]);

  const seuilActif = region === "seuil";

  return (
    <main className={s.monde}>
      {/* Surimpression persistante (Story 1.8) — EN TÊTE du DOM (hors régions inert) : la porte
          de secours est parmi les tout premiers arrêts de tabulation (AC3). Couche constante,
          jamais dans une région → jamais masquée/dissoute au changement de région (AC1). Le
          MODÈLE décide quoi porter (surimpressionPour) ; ce rendu ne fait que dessiner (AD-7). */}
      <Surimpression modele={surimpressionPour(region)} prepare={anamPrepare} />

      {/* Fond persistant — la scène est une, seul le premier plan se fond. */}
      <div className={s.ciel} aria-hidden>
        <div className={s.lune} />
      </div>
      <Etoiles />

      {/* L'arbre, ancre du monde (au centre). Le rendu CONSOMME la projection (lecture seule) :
          il DESSINE l'éveil, il ne le calcule pas (AD-7). */}
      {projection.tronc.present && (
        <div className={`${s.arbreMonde} imagerie fondu-image`} aria-hidden>
          <ArbreVivant eveil={projection.eveil} />
        </div>
      )}

      <div className={s.grain} aria-hidden />

      {/* ─────────── Région : le seuil (le rideau se lève) ─────────── */}
      <section
        className={`${s.region} ${s.seuil} ${seuilActif ? s.regionActive : ""}`}
        aria-label="Seuil"
        aria-hidden={seuilActif ? undefined : true}
        inert={seuilActif ? undefined : true}
      >
        <div className={`${s.seuilPersonnage} imagerie`}>
          <Image
            src="/scene/anam-seuil.png"
            alt=""
            fill
            sizes="(min-width: 1024px) 19rem, 58vw"
            priority
            className={`${s.seuilImg} fondu-personnage`}
          />
        </div>
        <div className={`${s.seuilTexte} voile-seuil`}>
          <h1 className="t-display" tabIndex={-1} ref={(el) => void (entetes.current.seuil = el)}>
            Anam
          </h1>
          <p className="t-anam fondu-texte">
            Bonsoir. Ce lieu ne te jugera pas — et ne te flattera pas non plus.
          </p>
          <button className={s.affordance} type="button" onClick={() => aller("accueil")}>
            <span className="t-bouton">entrer dans le monde</span>
          </button>
        </div>
      </section>

      {/* ─────────── Régions : les destinations, DÉRIVÉES du modèle (ordre + libellés) ─────────── */}
      {REGIONS.map((r) => {
        const actif = region === r.id;
        const estConversation = r.id === "anam";
        return (
          <section
            key={r.id}
            className={`${s.region} ${estConversation ? s.regionConversation : s.panneau} ${actif ? s.regionActive : ""}`}
            aria-label={r.nom}
            aria-hidden={actif ? undefined : true}
            inert={actif ? undefined : true}
          >
            {estConversation ? (
              <>
                {/* h1 unique de la vue (cible du focus programmatique) — quiet, la conversation suit. */}
                <h1
                  className={`t-titre-sm ${s.titreConversation}`}
                  tabIndex={-1}
                  ref={(el) => void (entetes.current[r.id] = el)}
                >
                  {r.nom}
                </h1>
                {/* Rendu de la conversation (AD-7 : adaptateur muet, ne parle qu'à app/api). */}
                <Conversation onPreparation={setAnamPrepare} propositionBranche={propositionBranche} />
              </>
            ) : (
              <div className={s.bloc}>
                {/* h1 par région : une seule est non-inert à la fois → une seule h1 exposée. */}
                <h1 className="t-titre" tabIndex={-1} ref={(el) => void (entetes.current[r.id] = el)}>
                  {r.nom}
                </h1>
                <p className="t-corps">{CORPS[r.id]}</p>
              </div>
            )}
          </section>
        );
      })}

      {/* Doublage non-spatial de rang égal (UX-DR-37) : mêmes liens nommés partout,
          barre basse en sm/md, rail à gauche en ≥ lg. Aucun cadenas/badge/compteur. */}
      <nav className={s.nav} aria-label="Régions">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={s.navLien}
            aria-current={region === r.id ? "location" : undefined}
            onClick={() => aller(r.id)}
          >
            <span className="t-bouton">{r.nom}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}
