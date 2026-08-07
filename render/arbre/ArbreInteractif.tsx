"use client";

/*
 * ArbreInteractif — la région « arbre » : le rendu MUET de l'arbre RÉEL (AD-7). Il CONSOMME la projection et
 * la dessine ; il ne décide ni ne garde aucune monotonie d'ÉCRITURE (celle-ci est le SQL / la Story 4.7).
 *
 * RÉÉCRIT après la revue adversariale (30 findings sur ce fichier). Corrections structurantes :
 *  • ALIGNEMENT (HAUTE) — un viewBox carré dans une boîte rectangulaire est LETTERBOXÉ par le navigateur :
 *    positionner les accroches en `%` du conteneur les décalait jusqu'à ~100 px du bois dessiné (AC3 mort).
 *    On mesure désormais le CARRÉ effectif (ResizeObserver) et SVG + accroches partagent ce même repère.
 *  • ZOOM (HAUTE) — `transform-origin` au coin haut-gauche faisait fuir l'arbre hors cadre en 4 clics ;
 *    l'origine est maintenant le CENTRE, et `cadrer` calcule un pan exact.
 *  • ANTI-RÉGRESSION AC2 [DUR] (HAUTE) — le repère du max vivait en `localStorage` : non scopé par
 *    utilisatrice (contamination entre comptes sur un navigateur partagé), jamais purgé (rémanence art. 9),
 *    empoisonnable (un « rayonnement » jamais atteint devenait permanent), et il s'EFFAÇAIT au repli.
 *    Il vit désormais EN MÉMOIRE de session (useRef) : aucune rémanence, aucune autorité cliente durable,
 *    et il ne s'efface plus quand la lecture est `indisponible`.
 *  • `indisponible` — une panne n'affiche plus « Rien n'a encore été nommé » (mensonge, cf. FR-029).
 *  • GLISSER vs TAP — seuil de déplacement : déplacer l'arbre en attrapant une accroche n'ouvre plus la fiche.
 *  • CLAVIER — flèches pour déplacer, Échap pour fermer la fiche, focus rendu au déclencheur.
 *  • `wheel` en écouteur NON PASSIF (React l'attache en passif : `preventDefault()` y était un no-op).
 * Le rendu ne parle qu'à `^/api/` (jamais la base, jamais un secret).
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  reconcilierProjection,
  intensiteBornee,
  doitDireOuNaissentLesBranches,
  ZOOM_MIN,
  ZOOM_MAX,
  type BrancheProjetee,
  type Camera,
  type ProjectionScene,
} from "@/lib/scene";
import { placerBranches, CANEVAS } from "./geometrie";
import EtatVideArbre from "./EtatVideArbre";
import {
  ARIA_CANEVAS,
  ARIA_ZONE_ARBRE,
  INDISPONIBLE_TITRE,
  INDISPONIBLE_CORPS,
  BASCULE_LISTE,
  BASCULE_ARBRE,
  ZOOM_PLUS,
  ZOOM_MOINS,
} from "./copie-arbre";
import FicheBranche, { type ResultatGeste } from "./FicheBranche";
import VueListe from "./VueListe";
import s from "./arbre.module.css";

/** Préférence d'AFFICHAGE seulement (aucune donnée art. 9) → localStorage acceptable. */
const CLE_VUE = "anima:arbre:vueListe";
/** Au-delà de ce déplacement, le geste est un GLISSER : le relâchement n'ouvre plus la fiche. */
const GLISSER_MIN_PX = 8;
const PAS_CLAVIER_PX = 40;

export interface ProprietesArbreInteractif {
  projection: ProjectionScene;
  camera: Camera;
  brancheSelectionnee: string | null;
  onCadrer: (camera: Camera) => void;
  onOuvrirFiche: (id: string) => void;
  onFermerFiche: () => void;
  onVoirDansConversation: (extraitSourceId: string) => void;
  onRenommer: (brancheId: string, nom: string) => Promise<boolean>;
  /** Story 4.7 (AC3) — le GESTE, transmis tel quel : le rendu ne décide pas d'un état (AD-7). */
  onDeclarerRayonnement?: (brancheId: string) => Promise<ResultatGeste>;
}

export default function ArbreInteractif(p: ProprietesArbreInteractif) {
  // ── AC2 [DUR] anti-régression : repère du max EN MÉMOIRE de session (aucune rémanence, aucune autorité
  //    cliente durable, aucune contamination entre comptes). La monotonie d'ÉCRITURE reste le SQL (4.7). ──
  const repere = useRef<ProjectionScene>({ tronc: { present: true }, branches: [] });
  const [affichees, setAffichees] = useState<readonly BrancheProjetee[]>(p.projection.branches);

  useEffect(() => {
    const { projection, incidents } = reconcilierProjection(repere.current, p.projection);
    if (!p.projection.indisponible) {
      // On FUSIONNE (jamais on n'écrase) : une absence ponctuelle n'efface pas un maximum connu.
      const parId = new Map(repere.current.branches.map((b) => [b.id, b]));
      for (const b of projection.branches) parId.set(b.id, b);
      repere.current = { tronc: { present: true }, branches: [...parId.values()] };
      setAffichees(projection.branches);
    }
    // UN seul signalement par réconciliation, portant les types constatés. Une requête PAR incident
    // faisait qu'une régression touchant plusieurs branches franchissait à elle seule le plafond de la
    // route : la vraie régression se faisait avaler par son propre bruit (re-revue).
    if (incidents.length > 0) {
      const champs = [...new Set(incidents.map((inc) => inc.champ))];
      fetch("/api/incident", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ champs }),
      }).catch(() => {});
    }
  }, [p.projection]);

  /** Texte de la région live persistante (voir le rendu). Aucune donnée art. 9 : des libellés statiques. */
  const [annonce, setAnnonce] = useState("");

  // ── AC8 : bascule vue liste / vue arbre, persistée (préférence d'affichage, sans art. 9) ──
  const [vueListe, setVueListe] = useState(false);
  useEffect(() => {
    try {
      setVueListe(localStorage.getItem(CLE_VUE) === "1");
    } catch {
      /* stockage indisponible : la vue arbre reste le défaut */
    }
  }, []);
  const basculer = () => {
    setVueListe((v) => {
      const n = !v;
      try {
        localStorage.setItem(CLE_VUE, n ? "1" : "0");
      } catch {
        /* best-effort */
      }
      return n;
    });
  };

  const placees = useMemo(() => placerBranches(affichees), [affichees]);
  const selectionnee = affichees.find((b) => b.id === p.brancheSelectionnee) ?? null;

  // Ce qui décide de la PRÉSENCE du canevas dans le DOM. Déclaré ICI, avant l'effet de mesure, parce que
  // cet effet en DÉPEND : un tableau de dépendances est évalué au rendu, donc s'y référer plus bas jetterait
  // un ReferenceError (zone morte temporelle).
  const indisponible = p.projection.indisponible === true;
  const vide = !indisponible && affichees.length === 0;
  const canevasVisible = !indisponible && !vueListe && !vide;
  /**
   * Story 3.3 (AC6) — la DÉCISION vient du modèle (`lib/scene`), jamais d'un test local sur l'entitlement.
   * Le rendu ne sait pas ce qu'est un abonnement et n'a pas à l'apprendre (AD-7) : il appelle une fonction
   * pure, il reçoit un booléen. La même valeur est passée aux DEUX vues — la liste et le canevas rendent le
   * même état vide, par le même composant, avec la même phrase.
   *
   * On lui passe `affichees`, pas `p.projection.branches` : c'est la liste RÉELLEMENT à l'écran (le repère
   * anti-régression peut la faire différer le temps d'un rendu). Sinon la phrase se déciderait sur un état
   * que personne ne voit — le genre d'écart d'une frame qui ne se reproduit jamais quand on le cherche.
   */
  const direOuNaissentLesBranches = doitDireOuNaissentLesBranches({ ...p.projection, branches: affichees });

  // ── Le CARRÉ effectif du canevas : SVG et accroches partagent EXACTEMENT ce repère (fin du décalage) ──
  const canevasRef = useRef<HTMLDivElement>(null);
  const [boite, setBoite] = useState({ cote: 0, gauche: 0, haut: 0, largeur: 0, hauteur: 0 });
  useLayoutEffect(() => {
    const el = canevasRef.current;
    if (!el) return;
    const mesurer = () => {
      const { width, height } = el.getBoundingClientRect();
      const cote = Math.min(width, height);
      setBoite({ cote, gauche: (width - cote) / 2, haut: (height - cote) / 2, largeur: width, hauteur: height });
    };
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    return () => ro.disconnect();
    // RE-REVUE (HAUTE) : la dépendance était `[vueListe]` SEUL. Le canevas n'existe pas quand l'arbre est
    // vide ou indisponible ; il APPARAÎT plus tard (elle nomme sa première branche, ou la lecture reprend)
    // sans que `vueListe` ne bouge → l'effet ne rejouait jamais, `boite.cote` restait 0, `.monde` était
    // posé en 0×0 et l'ARBRE ÉTAIT INVISIBLE dans le scénario NOMINAL de la story. On dépend donc de ce qui
    // conditionne réellement sa présence. Gardé par tests/rendu/arbre-mesure.test.tsx (montage réel).
  }, [canevasVisible]);

  const { onCadrer } = p;
  const zoomer = useCallback(
    (facteur: number) => onCadrer({ pan: p.camera.pan, zoom: p.camera.zoom * facteur }),
    [onCadrer, p.camera.pan, p.camera.zoom],
  );

  // `wheel` doit être NON PASSIF pour que preventDefault() morde (React l'attache en passif → no-op).
  // `canevasVisible` en dépendance pour la MÊME raison que l'effet de mesure : le canevas peut apparaître
  // après coup. Cet effet s'en tirait par accident (`zoomer` dépendait de l'objet `p` entier, recréé à
  // chaque rendu) — un accident qu'une mémoïsation des props aurait supprimé sans prévenir.
  useEffect(() => {
    const el = canevasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomer(e.deltaY < 0 ? 1.12 : 1 / 1.12);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomer, canevasVisible]);

  // ── Pan / pincement, avec SEUIL de glisser ──
  const pointeurs = useRef<Map<number, { x: number; y: number }>>(new Map());
  const depart = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null);
  const pincement = useRef<{ dist: number; zoom: number } | null>(null);
  const aGlisse = useRef(false);

  /**
   * Le canevas est l'ANCÊTRE de la fiche : sans ce filtre, tout geste fait DANS la fiche remontait au
   * canevas. Les flèches tapées dans le champ de renommage déplaçaient l'arbre au lieu du curseur (et
   * `preventDefault()` empêchait même de se déplacer dans son propre texte), et sélectionner un mot du
   * verbatim faisait glisser l'arbre (re-revue). On ignore donc ce qui vient de la fiche ou d'une saisie.
   */
  const horsCanevas = (cible: EventTarget | null) => {
    if (!(cible instanceof Element)) return false;
    if (cible.closest("[data-couche-fiche]")) return true;
    const el = cible as HTMLElement;
    return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable === true;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (horsCanevas(e.target)) return;
    // Capture du pointeur : sans elle, un bouton relâché HORS du canevas n'émet jamais `pointerup`,
    // `depart` restait armé et l'arbre suivait le curseur sans bouton pressé (re-revue).
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* certains navigateurs refusent la capture sur un pointeur déjà relâché : le pan reste utilisable */
    }
    pointeurs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointeurs.current.size === 1) {
      aGlisse.current = false;
      depart.current = { x: e.clientX, y: e.clientY, pan: p.camera.pan };
    } else if (pointeurs.current.size === 2) {
      const [a, b] = [...pointeurs.current.values()];
      pincement.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: p.camera.zoom };
      depart.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointeurs.current.has(e.pointerId)) return;
    pointeurs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointeurs.current.size === 2 && pincement.current) {
      const [a, b] = [...pointeurs.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      aGlisse.current = true;
      p.onCadrer({ pan: p.camera.pan, zoom: pincement.current.zoom * (dist / pincement.current.dist) });
    } else if (depart.current) {
      const dx = e.clientX - depart.current.x;
      const dy = e.clientY - depart.current.y;
      if (Math.hypot(dx, dy) > GLISSER_MIN_PX) aGlisse.current = true;
      if (aGlisse.current) {
        p.onCadrer({ zoom: p.camera.zoom, pan: { x: depart.current.pan.x + dx, y: depart.current.pan.y + dy } });
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* déjà relâchée */
    }
    pointeurs.current.delete(e.pointerId);
    if (pointeurs.current.size < 2) pincement.current = null;
    if (pointeurs.current.size === 0) depart.current = null;
  };

  /**
   * Taille À L'ÉCRAN de la zone cliquable d'une accroche, en px.
   *
   * RE-REVUE (HAUTE) — elle valait 44 px CONSTANTS (contre-échelle 1/zoom) alors que l'écartement entre
   * accroches décroît quand l'arbre se densifie : à partir d'une dizaine de branches, une cible recouvrait
   * le point visible de sa voisine et c'est la fiche de LA VOISINE qui s'ouvrait. Une cible qui ouvre la
   * mauvaise branche est pire qu'une cible petite. On la borne donc à la moitié de l'écartement réel — et
   * ZOOMER la fait regrandir jusqu'à 44 px, puisque l'écartement à l'écran croît avec le zoom.
   * Le plancher d'adressabilité au sens de UX-DR-42 reste tenu par la VUE LISTE (équivalent non spatial,
   * AC8), qui liste chaque branche en toutes lettres — c'est l'exception « autre moyen » de WCAG 2.5.8.
   */
  const tailleAccrochePx = (ecartVoisin: number) => {
    const CIBLE_MAX = 44;
    if (!Number.isFinite(ecartVoisin) || !boite.cote) return CIBLE_MAX; // seule branche, ou pas encore mesuré
    // `ecartVoisin` est en unités de canevas (1000) ; à l'écran, un point d'accroche voit `cote/1000 * zoom` px.
    const ecartPx = ecartVoisin * (boite.cote / CANEVAS.largeur) * p.camera.zoom;
    // AUCUN PLANCHER, volontairement. Un plancher garantirait le recouvrement dès que l'écartement passe
    // en dessous — c'est-à-dire qu'il ferait ouvrir LA MAUVAISE BRANCHE, ce qui est pire qu'une cible
    // petite : l'utilisatrice croirait lire une prise de conscience qui n'est pas celle qu'elle a visée.
    // La règle 0,9 × écartement garantit la non-superposition pour TOUTE paire (chaque cible vaut au plus
    // 0,9 fois sa distance au plus proche voisin, donc la somme des demi-tailles reste sous la distance).
    return Math.min(CIBLE_MAX, ecartPx * 0.9);
  };

  /** Ramène l'accroche au centre du conteneur (origine de transform = centre du carré). */
  const cadrerBranche = (accroche: { x: number; y: number }) => {
    const { cote } = boite;
    if (!cote) return;
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, 1.8));
    const px = (accroche.x / CANEVAS.largeur) * cote;
    const py = (accroche.y / CANEVAS.hauteur) * cote;
    p.onCadrer({ zoom, pan: { x: -zoom * (px - cote / 2), y: -zoom * (py - cote / 2) } });
  };

  // Déplacement au CLAVIER (le pan doigt/molette n'est pas atteignable au clavier — plancher UX-DR-42).
  const onKeyDownZone = (e: React.KeyboardEvent) => {
    // Une flèche tapée dans la fiche (champ de renommage, verbatim) appartient à la fiche, pas à l'arbre.
    if (horsCanevas(e.target)) return;
    const pas: Record<string, [number, number]> = {
      ArrowLeft: [PAS_CLAVIER_PX, 0],
      ArrowRight: [-PAS_CLAVIER_PX, 0],
      ArrowUp: [0, PAS_CLAVIER_PX],
      ArrowDown: [0, -PAS_CLAVIER_PX],
    };
    const d = pas[e.key];
    if (!d) return;
    e.preventDefault();
    p.onCadrer({ zoom: p.camera.zoom, pan: { x: p.camera.pan.x + d[0], y: p.camera.pan.y + d[1] } });
  };

  // Échap ferme la fiche ; le focus retourne à l'accroche qui l'a ouverte.
  const accroches = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const dernierDeclencheur = useRef<string | null>(null);
  const fermerFiche = useCallback(() => {
    const id = dernierDeclencheur.current;
    p.onFermerFiche();
    if (id) requestAnimationFrame(() => accroches.current.get(id)?.focus());
  }, [p]);
  useEffect(() => {
    if (!selectionnee) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermerFiche();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectionnee, fermerFiche]);

  const ouvrir = (id: string) => {
    dernierDeclencheur.current = id;
    p.onOuvrirFiche(id);
  };

  return (
    <div className={s.arbre}>
      {/* Région d'annonce a11y PERSISTANTE (même patron que la conversation). Elle vit ICI, et pas dans le
          champ de renommage, parce que ce champ est DÉMONTÉ au moment même où il aurait quelque chose à
          annoncer : le succès du renommage restait donc entièrement muet (re-revue). */}
      <p className={s.annonce} aria-live="polite" aria-atomic="true">
        {annonce}
      </p>

      <div className={s.barre}>
        {/* `aria-pressed` retiré : combiné à un libellé qui bascule, il annonçait l'inverse de la réalité. */}
        <button type="button" className={s.actionSecondaire} onClick={basculer}>
          {vueListe ? BASCULE_ARBRE : BASCULE_LISTE}
        </button>
        {!vueListe && !vide && !indisponible && (
          <div className={s.zoomBoutons}>
            <button type="button" className={s.zoomBouton} onClick={() => zoomer(1 / 1.2)} aria-label={ZOOM_MOINS}>
              <span aria-hidden>−</span>
            </button>
            <button type="button" className={s.zoomBouton} onClick={() => zoomer(1.2)} aria-label={ZOOM_PLUS}>
              <span aria-hidden>+</span>
            </button>
          </div>
        )}
      </div>

      {indisponible ? (
        <div className={s.vide}>
          <p className={s.videTitre}>{INDISPONIBLE_TITRE}</p>
          <p className={s.videCorps}>{INDISPONIBLE_CORPS}</p>
        </div>
      ) : vueListe ? (
        <VueListe
          branches={affichees}
          onOuvrir={ouvrir}
          onVoirDansConversation={p.onVoirDansConversation}
          onRenommer={p.onRenommer}
          onAnnoncer={setAnnonce}
          planOuvert={p.projection.planOuvert === true}
          direOuNaissentLesBranches={direOuNaissentLesBranches}
        />
      ) : vide ? (
        // AC2 [DUR] — LE MÊME composant que la vue liste (voir `EtatVideArbre`).
        <EtatVideArbre direOuNaissentLesBranches={direOuNaissentLesBranches} />
      ) : (
        <div
          ref={canevasRef}
          className={s.canevas}
          tabIndex={0}
          role="group"
          aria-label={ARIA_ZONE_ARBRE}
          onKeyDown={onKeyDownZone}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            className={`${s.monde} ${selectionnee ? s.mondeEstompe : ""}`}
            style={{
              left: boite.gauche,
              top: boite.haut,
              width: boite.cote,
              height: boite.cote,
              transform: `translate(${p.camera.pan.x}px, ${p.camera.pan.y}px) scale(${p.camera.zoom})`,
            }}
          >
            <svg viewBox={`0 0 ${CANEVAS.largeur} ${CANEVAS.hauteur}`} className={s.svg} role="img" aria-label={ARIA_CANEVAS}>
              {/* Tronc + racines — matière argentée, présent d'emblée (FR-088). */}
              <path
                d="M 500 950 C 470 900 450 880 430 880 M 500 950 C 530 900 550 880 570 880 M 500 950 L 500 560"
                className={s.tronc}
              />
              {placees.map((pl) => {
                const intensite = intensiteBornee(pl.branche.intensite);
                return (
                  <g key={pl.branche.id}>
                    {/*
                      Le bois — épaisseur CONTINUE, portée par l'intensité (2 px nu → 3,2 px pleinement
                      feuillu, DESIGN L599-L600).

                      ⚠️ REVUE — l'épaisseur dépendait de l'ENUM : le premier retour la faisait sauter de
                      2 à 3,2 px d'un coup, en même temps que cinq feuilles apparaissaient ex nihilo.
                      FR-028 exige l'inverse mot pour mot : « progressive, jamais binaire ; la matière
                      s'installe PAR DEGRÉS — le trait s'épaissit, les feuilles se déplient AU FIL DES
                      RETOURS ». Le champ `intensite` existait précisément pour ça et le rendu l'ignorait
                      pour l'épaisseur : la seule chose qui se lisait à l'écran était un basculement.
                    */}
                    <line
                      x1={pl.fourche.x}
                      y1={pl.fourche.y}
                      x2={pl.x}
                      y2={pl.y}
                      className={s.branche}
                      strokeWidth={2 + intensite * 1.2}
                    />
                    {/*
                      Feuillage — densité CONTINUE elle aussi. Le premier retour (intensité 0,2) déplie
                      DEUX feuilles, pas cinq ; le feuillage plein en compte douze. Bornée : une valeur
                      folle ne peut pas geler le rendu.
                    */}
                    {pl.branche.etat !== "naissance" &&
                      Array.from({ length: Math.max(1, Math.round(intensite * 12)) }).map((_, k) => (
                        <circle
                          key={k}
                          cx={pl.x + Math.cos(k * 2.4) * (10 + k * 3)}
                          cy={pl.y + Math.sin(k * 2.4) * (10 + k * 3)}
                          r={7}
                          className={s.feuille}
                          opacity={0.5 + intensite * 0.5}
                        />
                      ))}
                    {/* Rayonnement — pleine lumière nacre, STATIQUE, aucun objet-fruit suspendu. */}
                    {pl.branche.etat === "rayonnement" && <circle cx={pl.x} cy={pl.y} r={44} className={s.rayonnement} />}
                    <circle cx={pl.accroche.x} cy={pl.accroche.y} r={9} className={s.accrocheDot} />
                  </g>
                );
              })}
            </svg>

            {/* Accroches CLIQUABLES — dans le MÊME repère carré que le SVG (alignement exact), taille CSS
                constante ≥44px quel que soit le zoom (contre-échelle 1/zoom). */}
            {placees.map((pl) => (
              <button
                key={pl.branche.id}
                ref={(el) => void accroches.current.set(pl.branche.id, el)}
                type="button"
                className={s.accroche}
                style={{
                  left: `${(pl.accroche.x / CANEVAS.largeur) * 100}%`,
                  top: `${(pl.accroche.y / CANEVAS.hauteur) * 100}%`,
                  width: tailleAccrochePx(pl.ecartVoisin),
                  height: tailleAccrochePx(pl.ecartVoisin),
                  transform: `translate(-50%, -50%) scale(${1 / p.camera.zoom})`,
                }}
                aria-label={`Branche : ${pl.branche.nom?.trim() || "sans nom"}`}
                onClick={() => {
                  if (aGlisse.current) return; // un glisser n'ouvre pas la fiche
                  ouvrir(pl.branche.id);
                }}
              />
            ))}
          </div>

        </div>
      )}

      {/*
        ⚠️ LA FICHE EST HORS DU TERNAIRE (revue 4.10), et ce déplacement corrige un cul-de-sac.

        Elle n'était rendue que dans la branche CANEVAS. Or `allerVersBranche` — le geste de l'invitation
        d'Anam (« La voir ») — fait `aller("arbre")` puis `ouvrirFiche`, et la préférence de vue est
        PERSISTÉE en localStorage. Une utilisatrice passée en vue liste une seule fois arrivait donc sur
        la région arbre et **rien ne s'ouvrait** : l'invitation redevenait exactement ce que la story
        appelle « un reproche ». Idem quand l'arbre est vide ou indisponible.

        C'est le pendant symétrique du défaut que la revue 4.6 avait corrigé sur le renommage (« un
        utilisateur clavier ne pouvait tout simplement pas renommer ») : une action ne peut pas n'exister
        que dans une des deux vues de rang égal.

        Couche de fiche : capte les clics → « un tap à côté ferme » (UX-DR-26), sans piège au focus.
      */}
      {selectionnee && (
        <div
          className={s.ficheCouche}
          data-couche-fiche=""
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) fermerFiche();
          }}
        >
          <FicheBranche
            key={selectionnee.id}
            branche={selectionnee}
            onFermer={fermerFiche}
            onVoirDansConversation={p.onVoirDansConversation}
            onRenommer={p.onRenommer}
            onDeclarerRayonnement={p.onDeclarerRayonnement}
            gesteSuspendu={p.projection.gestesSuspendus === true}
            planOuvert={p.projection.planOuvert === true}
            onAnnoncer={setAnnonce}
            /* Le recadrage n'a de sens qu'en vue canevas : hors d'elle, il n'y a rien à cadrer, et
               proposer un bouton qui ne fait rien serait un cul-de-sac de plus. */
            onCentrer={
              vueListe || vide || indisponible
                ? undefined
                : () => {
                    // Remplace le double-clic sur l'accroche, qui ne pouvait JAMAIS se déclencher : le
                    // premier clic ouvrait la fiche, dont la couche `inset: 0` captait le second (re-revue).
                    const pl = placees.find((q) => q.branche.id === selectionnee.id);
                    fermerFiche();
                    if (pl) cadrerBranche(pl.accroche);
                  }
            }
          />
        </div>
      )}
    </div>
  );
}
