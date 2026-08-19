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
import { useRouter } from "next/navigation";
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
  adopterProjection,
  etatInitial,
  reducteurVue,
  surimpressionPour,
  type IdRegion,
  type ProjectionScene,
} from "@/lib/scene";
import ArbreVivant from "./arbre-vivant";
import ArbreInteractif from "./arbre/ArbreInteractif";
import Surimpression from "./surimpression";
import Conversation from "./conversation/Conversation";
import EchangeSource from "./conversation/EchangeSource";
import Bibliotheque from "./accueil/Bibliotheque";
import type { BibliothequeVue } from "./accueil/types";
import type { TourHistorique } from "./conversation/types";
import type { OuvertureData } from "./conversation/types";
import type { ResultatGeste } from "./arbre/FicheBranche";
import s from "./monde.module.css";

export interface ProprietesSceneRendue {
  /** Domain-projection serveur, en lecture seule (AD-7). Le rendu ne l'écrit jamais. */
  projection: ProjectionScene;
  /**
   * Story 4.5, arbitrée en 4.10 — ce que le SERVEUR a décidé d'ouvrir : une proposition de branche, une
   * invitation à faire vivre celle qui attend (FR-030), ou rien. Générique, aucun art. 9, et surtout
   * AUCUN COMPTE (FR-031/AC5 [DUR]) : le chiffre est mort côté serveur.
   */
  ouverture?: OuvertureData | null;
  /**
   * La mention de complétion du socle a ATTEINT L'ÉCRAN (revue du 2026-08-12, B3).
   *
   * Le rendu ne dépense rien lui-même — il SIGNALE, et c'est la page qui appelle la Server Action.
   * La séparation n'est pas décorative : `render/` ne connaît ni base ni session (AD-7), et c'est
   * ce qui permet aux tests de rendu de monter la scène sans Supabase.
   */
  onSocleAnnonce?: () => void;
  /**
   * Story 5.5 (AC2) — l'hypothèse d'Anam a ATTEINT L'ÉCRAN. Même séparation que ci-dessus : le
   * rendu SIGNALE, la page appelle la Server Action. `render/` ne connaît ni base ni session (AD-7).
   */
  onHypotheseDite?: (hypotheseId: string) => void;
  /**
   * Story 5.6 — la bibliothèque de l'accueil, DÉJÀ ORDONNÉE par le serveur (ordre fixe + carte du
   * jour en tête). Le rendu ne trie ni ne filtre : lui donner ce pouvoir annulerait la garde
   * « jamais algorithmique » que `lib/domain/bibliotheque.ts` tient (FR-033).
   *
   * `null` = la lecture a échoué. La scène s'ouvre quand même (AC7) : l'accueil est une région
   * parmi quatre, et une panne de socle ne doit fermer ni la conversation ni l'arbre.
   */
  bibliotheque?: BibliothequeVue | null;
  /** QA tour 1 (T3) — le fil déjà écrit, pour que le rechargement ne l\u2019efface plus. */
  historique?: readonly TourHistorique[];
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
  accueil: "", // la région accueil rend <Bibliotheque/> depuis la Story 5.6
  anam: "", // la région anam rend <Conversation/>, jamais ce placeholder (Story 2.2)
  arbre: "Ton arbre grandira à mesure que tu avances.",
};

export default function SceneDom({
  projection,
  ouverture,
  onSocleAnnonce,
  onHypotheseDite,
  bibliotheque,
  historique,
}: ProprietesSceneRendue) {
  const [etat, dispatch] = useReducer(reducteurVue, etatInitial);
  const region = etat.regionCourante;
  /* Naviguer par la barre ANNULE le rejeu de l'échange source : sans ça, `echangeExtrait` restait collé et
     la région Anam demeurait bloquée sur l'ancien extrait, sans composeur (piège de navigation, revue 4.6). */
  const aller = (cible: IdRegion) => {
    setEchangeExtrait(null);
    dispatch({ type: "aller", cible });
  };

  // État « Anam prépare » (AC2) remonté de la conversation → épaissit le signe de la surimpression.
  // Présentation pure (pas de domaine) ; SceneDom, hôte du view-state, le porte (AD-7).
  const [anamPrepare, setAnamPrepare] = useState(false);

  // Story 4.6 — la projection AFFICHÉE. Seedée par le serveur ET RESYNCHRONISÉE quand la prop change :
  // sans cette resynchronisation, une branche née pendant la session n'apparaissait JAMAIS dans l'arbre
  // (props-into-state figé — revue 4.6). Patron React officiel d'ajustement d'état pendant le rendu.
  // …et une lecture INDISPONIBLE n'efface pas un arbre déjà affiché : c'est `adopterProjection` (lib/scene)
  // qui tranche, pas ce composant (AD-7 — le rendu dessine, il ne décide pas).
  const [projLocale, setProjLocale] = useState(projection);
  const [projPrec, setProjPrec] = useState(projection);
  if (projection !== projPrec) {
    setProjPrec(projection);
    setProjLocale((affichee) => adopterProjection(affichee, projection));
  }

  // « Voir dans la conversation » : l'extrait source en cours de lecture (null = fil de conversation normal).
  const [echangeExtrait, setEchangeExtrait] = useState<string | null>(null);
  const router = useRouter();

  const voirDansConversation = (extraitSourceId: string) => {
    setEchangeExtrait(extraitSourceId);
    dispatch({ type: "voirDansConversation" }); // mémorise le cadrage de l'arbre (retour restaurable)
  };
  const retourArbre = () => {
    setEchangeExtrait(null);
    dispatch({ type: "revenir" }); // restaure région + caméra + fiche (AC4)
  };

  /**
   * Story 4.10 (AC4) — l'invitation d'Anam MÈNE quelque part : elle emmène à la région arbre et ouvre la
   * fiche de la branche visée, là où vivent les trois gestes qui la font vivre (plan d'étapes, retour sur
   * le thème, déclaration de pleine lumière). Sans ce chemin, l'invitation serait un constat sur ce
   * qu'elle n'a pas fait — c'est-à-dire un reproche.
   *
   * Deux actions du réducteur pur, aucune décision ici (AD-7) : le rendu navigue, il ne tranche rien.
   */
  const allerVersBranche = (brancheId: string) => {
    aller("arbre");
    dispatch({ type: "ouvrirFiche", brancheId });
  };

  /**
   * Story 5.5 (AC2) — l'hypothèse mène à la HALTE, pas à une région. C'est la différence avec
   * l'invitation ci-dessus : les trois réponses (accepter, refuser, corriger) demandent une page à
   * elles, hors des trois régions de la scène — patron `/heure-naissance` (5.3, décision D11).
   */
  const allerVersHypothese = () => router.push("/enneagramme");

  // Le renommage passe par la route (jamais d'écriture DB au rendu, AD-7). Succès → nom mis à jour localement.
  const renommer = async (brancheId: string, nom: string): Promise<boolean> => {
    try {
      const r = await fetch("/api/anam/branche", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "renommer", brancheId, nom }),
      });
      if (r.ok) {
        setProjLocale((p) => ({ ...p, branches: p.branches.map((b) => (b.id === brancheId ? { ...b, nom } : b)) }));
      }
      return r.ok;
    } catch {
      return false;
    }
  };

  // Story 4.7 (AC3) — LE GESTE. Même posture exactement que le renommage : le rendu transmet une
  // intention, le serveur écrit et garde (D3 : la fenêtre détresse refuse au point d'écriture). On ne
  // met à jour localement QU'EN CAS DE SUCCÈS — afficher la pleine lumière sur un refus serait un
  // mensonge optimiste, et sur un état irréversible c'est le pire moment pour en faire un.
  const declarerRayonnement = async (brancheId: string): Promise<ResultatGeste> => {
    try {
      const r = await fetch("/api/anam/branche", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "rayonnement", brancheId }),
      });
      // REVUE — un REFUS (403, garde de détresse) n'est pas une panne : réessayer n'y changera rien
      // pendant des heures. Les confondre faisait promettre « tu peux réessayer » à quelqu'un qui sort
      // d'une crise, et l'invitait à se heurter au même mur.
      if (!r.ok) return r.status === 403 ? "refus" : "panne";
      {
        // La DATE vient du serveur au prochain chargement ; en local on ne pose que l'état, jamais une
        // date fabriquée au client (elle différerait de celle qui fait foi).
        setProjLocale((p) => ({
          ...p,
          branches: p.branches.map((b) => (b.id === brancheId ? { ...b, etat: "rayonnement" as const } : b)),
        }));
      }
      return "ok";
    } catch {
      return "panne";
    }
  };

  // Focus déplacé vers l'entête de la région ACTIVÉE (AC3), jamais au montage initial.
  // On compare à la région précédente (robuste au double-montage de React StrictMode,
  // contrairement à un simple booléen « déjà monté »).
  const entetes = useRef<Partial<Record<IdRegion, HTMLElement | null>>>({});
  const regionPrec = useRef<IdRegion>(region);
  useEffect(() => {
    if (regionPrec.current !== region) {
      entetes.current[region]?.focus();
      regionPrec.current = region;
      // En ENTRANT dans l'arbre, on redemande la projection au serveur : une branche née pendant la séance
      // (Story 4.5) doit y apparaître. Le rendu ne lit pas la base — il demande un nouveau rendu serveur.
      if (region === "arbre") router.refresh();
    }
  }, [region, router]);

  const seuilActif = region === "seuil";

  return (
    <main className={s.monde}>
      {/* Surimpression persistante (Story 1.8) — EN TÊTE du DOM (hors régions inert) : la porte
          de secours est parmi les tout premiers arrêts de tabulation (AC3). Couche constante,
          jamais dans une région → jamais masquée/dissoute au changement de région (AC1). Le
          MODÈLE décide quoi porter (surimpressionPour) ; ce rendu ne fait que dessiner (AD-7). */}
      <Surimpression
        modele={surimpressionPour(region, projection.abonnementGerable === true)}
        prepare={anamPrepare}
      />

      {/* Fond persistant — la scène est une, seul le premier plan se fond. */}
      <div className={s.ciel} aria-hidden>
        <div className={s.lune} />
      </div>
      <Etoiles />

      {/* Le DÉCOR de fond (ambiance, aria-hidden) — un arbre calme derrière toute la scène. L'arbre RÉEL et
          adressable (branches, fiche, pan/zoom) vit dans la région « arbre ». AD-7 : décor muet, sans donnée. */}
      {projection.tronc.present && (
        <div className={`${s.arbreMonde} imagerie fondu-image`} aria-hidden>
          <ArbreVivant />
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
            {/* ⚠️ AUCUNE SALUTATION D'HEURE ICI (QA visuelle du 2026-08-19, M4). « Bonsoir » a été
                relevé à 9 h 55 puis à 10 h 15 du matin, sur deux comptes. Une salutation fausse
                sur le tout premier écran coûte plus qu'elle ne rapporte : elle dit à quelqu'un
                que le lieu ne le regarde pas. La rendre juste demanderait l'heure de
                L'UTILISATRICE — le serveur est en UTC — et `render/` n'a pas le droit d'importer
                `lib/domain` (AD-7/AD-10) : ce n'est donc pas un mot à replacer ici, c'est une
                donnée à faire descendre. En attendant, la phrase ne ment plus. */}
            Ce lieu ne te jugera pas — et ne te flattera pas non plus.
          </p>
          <button className={s.affordance} type="button" onClick={() => aller("accueil")}>
            <span className="t-bouton">entrer dans le monde</span>
          </button>
        </div>
      </section>

      {/* ─────────── Régions : les destinations, DÉRIVÉES du modèle (ordre + libellés) ─────────── */}
      {REGIONS.map((r) => {
        const actif = region === r.id;
        const classe = r.id === "anam" ? s.regionConversation : r.id === "arbre" ? s.regionArbre : s.panneau;
        return (
          <section
            key={r.id}
            className={`${s.region} ${classe} ${actif ? s.regionActive : ""}`}
            aria-label={r.nom}
            aria-hidden={actif ? undefined : true}
            inert={actif ? undefined : true}
          >
            {r.id === "anam" ? (
              <>
                {/* h1 unique de la vue (cible du focus programmatique) — quiet, la conversation suit. */}
                <h1
                  className={`t-titre-sm ${s.titreConversation}`}
                  tabIndex={-1}
                  ref={(el) => void (entetes.current[r.id] = el)}
                >
                  {r.nom}
                </h1>
                {/* La Conversation reste MONTÉE en permanence : la démonter détruisait tout le fil de la
                    séance en cours et ré-amorçait la proposition de branche de 4.5 (revue 4.6, HAUTE).
                    L'échange source persisté se SUPERPOSE (AC4), puis le retour redonne le fil intact. */}
                <div className={echangeExtrait ? s.masque : s.transparent}>
                  <Conversation
                    onPreparation={setAnamPrepare}
                    ouverture={ouverture}
                    historique={historique}
                    onAllerVersBranche={allerVersBranche}
                    onAllerVersHypothese={allerVersHypothese}
                    onHypotheseDite={onHypotheseDite}
                    /* B3 — la mention de complétion ne se dépense que si CETTE région est active :
                       rendue sous `inert`, elle n'est vue ni annoncée par personne. */
                    regionActive={actif}
                    onSocleAnnonce={onSocleAnnonce}
                  />
                </div>
                {echangeExtrait && <EchangeSource extraitSourceId={echangeExtrait} onRetour={retourArbre} />}
              </>
            ) : r.id === "arbre" ? (
              <>
                <h1
                  className={`t-titre-sm ${s.titreConversation}`}
                  tabIndex={-1}
                  ref={(el) => void (entetes.current[r.id] = el)}
                >
                  {r.nom}
                </h1>
                {/* L'arbre RÉEL : projection muette + fiche + vue liste + pan/zoom (AD-7). */}
                <ArbreInteractif
                  projection={projLocale}
                  camera={etat.camera}
                  brancheSelectionnee={etat.brancheSelectionnee}
                  onCadrer={(camera) => dispatch({ type: "cadrer", camera })}
                  onOuvrirFiche={(id) => dispatch({ type: "ouvrirFiche", brancheId: id })}
                  onFermerFiche={() => dispatch({ type: "fermerFiche" })}
                  onVoirDansConversation={voirDansConversation}
                  onRenommer={renommer}
                  onDeclarerRayonnement={declarerRayonnement}
                />
              </>
            ) : (
              <div className={s.bloc}>
                {/* h1 par région : une seule est non-inert à la fois → une seule h1 exposée. */}
                <h1 className="t-titre" tabIndex={-1} ref={(el) => void (entetes.current[r.id] = el)}>
                  {r.nom}
                </h1>
                {/* Story 5.6 — la bibliothèque remplace le texte d'attente. Une lecture en panne
                    (`null`) laisse la région vide plutôt que de fermer la scène (AC7). */}
                {r.id === "accueil" ? (
                  bibliotheque ? (
                    <Bibliotheque bibliotheque={bibliotheque} />
                  ) : null
                ) : (
                  <p className="t-corps">{CORPS[r.id]}</p>
                )}
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
