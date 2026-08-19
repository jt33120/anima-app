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
  etatInitialPour,
  reducteurVue,
  regionDOuverture,
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
import PremierPassage, { type PremierPassageVue } from "./premier-passage";
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
  /**
   * H4 (QA visuelle du 2026-08-19) — le seuil parle-t-il un peu plus longtemps cette fois ?
   *
   * Absent = non, et c'est le repli de tous les tests de rendu qui montent la scène sans base.
   * Le rendu ne DÉCIDE pas s'il est dû : `lib/domain/premier-passage.ts` le décide, la page le lui
   * passe. Lui donner ce pouvoir demanderait de lui donner la date, donc la session (AD-7).
   */
  premierPassage?: PremierPassageVue;
  /**
   * Le seuil vient d'être FRANCHI — le geste, pas le rendu.
   *
   * ⚠️ CETTE DISTINCTION EST TOUTE LA CORRECTION. Le seuil est rendu à chaque chargement : marquer
   * au rendu poserait la date à la première ouverture, y compris pour quelqu'un qui referme
   * l'onglet sans avoir rien lu — le texte serait perdu sans avoir jamais été vu. C'est le défaut
   * exact que la 0045 a corrigé pour la mention du socle. Le rendu SIGNALE, la page appelle la
   * Server Action.
   */
  onSeuilFranchi?: () => void;
  /**
   * Le seuil a-t-il DÉJÀ été franchi ? Si oui, le monde s’ouvre sur l’accueil.
   *
   * ⚠️ LA DÉCISION N’EST PAS ICI, ET C’EST LA RAISON DE CETTE PROPRIÉTÉ PLUTÔT QUE D’UN CALCUL.
   * `render/` n’a le droit de connaître ni la date, ni la session, ni `lib/domain` (AD-7/AD-10) :
   * la page lit `seuil_franchi_le`, le modèle (`regionDOuverture`) en tire la région d’ouverture,
   * et ce fichier ne fait que la consommer. Absente → le seuil, qui est le repli sûr : c’est aussi
   * ce que voient les tests de rendu qui montent la scène sans base.
   */
  seuilDejaFranchi?: boolean;
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

/* ══ LE GLISSEMENT LATÉRAL ENTRE RÉGIONS (QA manuelle du 2026-08-19) ═════════════════════════════
 *
 * « J'aimerais pouvoir swiper entre les trois écrans, une dynamique d'appli quoi. »
 *
 * ⚠️ LE DOIGT MÈNE, L'ANIMATION NE FAIT QUE FINIR SA PHRASE. Un geste qui se contente de
 * DÉCLENCHER une transition à la fin n'est pas un glissement : c'est un bouton qu'on actionne
 * bizarrement. Les régions sont toutes en `inset: 0` — la voisine est donc exactement à
 * `translateX(±100%)`, et suivre le doigt ne demande aucune piste, aucun conteneur, aucune
 * restructuration du DOM. C'est ce qui rend cette version-ci petite.
 *
 * ⚠️ ET LES DEUX RÉGIONS RESTENT OPAQUES PENDANT LE GESTE. Elles sont CÔTE À CÔTE, jamais
 * superposées : on ne réintroduit pas la double exposition que le fondu de région vient d'éliminer
 * (voir `.region` dans monde.module.css et `e2e/seuil.spec.ts`, [LE FONDU]).
 */

/** Le déplacement, en pixels, au-delà duquel on tranche l'axe du geste. */
const AXE_TRANCHE = 12;
/** Ce qu'il faut parcourir pour que la région change vraiment. En deçà, le monde revient. */
const FRANCHISSEMENT = 56;
/** La durée de la fin de geste. Le CSS ne la connaît pas : elle est posée en style en ligne, donc
 *  déclarée UNE fois, ici — un jeton dupliqué finit toujours par diverger de l'autre. */
const DUREE_FIN = 280;

interface Glissement {
  /** La région d'où l'on part. Indépendante de `regionCourante` : après la bascule, elle sert
   *  encore à sortir l'ancienne région de l'écran sans qu'un fondu ne la ramène au centre. */
  readonly de: IdRegion;
  /** Celle vers laquelle on va, ou `null` en bout de course (le monde ne boucle pas). */
  readonly vers: IdRegion | null;
  readonly dx: number;
  /** Le doigt est parti : le mouvement finit tout seul, avec une transition. */
  readonly fin: boolean;
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
  premierPassage,
  onSeuilFranchi,
  seuilDejaFranchi = false,
}: ProprietesSceneRendue) {
  const [etat, dispatch] = useReducer(
    reducteurVue,
    seuilDejaFranchi,
    (franchi) => etatInitialPour(regionDOuverture(franchi)),
  );
  const region = etat.regionCourante;
  /* Naviguer par la barre ANNULE le rejeu de l'échange source : sans ça, `echangeExtrait` restait collé et
     la région Anam demeurait bloquée sur l'ancien extrait, sans composeur (piège de navigation, revue 4.6). */
  /**
   * H4 — le seuil est FRANCHI quand on arrive à l'accueil, par la porte ou par la barre.
   *
   * ⚠️ AU GESTE, JAMAIS AU RENDU, et ce n'est pas un détail de style. Le seuil et l'accueil sont
   * rendus à CHAQUE chargement (toutes les régions sont montées, une seule est active) : marquer
   * au rendu poserait la date à la première ouverture, y compris pour quelqu'un qui referme
   * l'onglet sans avoir rien lu — la présentation serait perdue sans avoir jamais été vue. C'est
   * exactement le défaut que la 0045 a corrigé pour la mention du socle.
   *
   * Le `ref` évite d'appeler la Server Action à chaque aller-retour vers l'accueil dans la même
   * page : la RPC est idempotente (`where seuil_franchi_le is null`), donc ce n'est pas une garde
   * — c'est de la politesse envers le réseau. La garde, elle, est en SQL.
   */
  const franchissementSignale = useRef(false);
  const aller = (cible: IdRegion) => {
    setEchangeExtrait(null);
    dispatch({ type: "aller", cible });
    if (
      cible === "accueil" &&
      premierPassage?.du &&
      !franchissementSignale.current
    ) {
      franchissementSignale.current = true;
      onSeuilFranchi?.();
    }
  };

  /* ── LE GESTE : le doigt mène (voir le bloc « LE GLISSEMENT LATÉRAL » plus haut) ───────────── */
  const ordre = useMemo(() => REGIONS.map((r) => r.id), []);
  const rang = ordre.indexOf(region);
  const [glisse, setGlisse] = useState<Glissement | null>(null);
  /* Le geste en cours vit dans un `ref` : il change à chaque `pointermove` et ne doit RIEN
     redessiner tant que l'axe n'est pas tranché. Un `useState` ici ferait un rendu par pixel. */
  const geste = useRef<{ x0: number; y0: number; axe: "?" | "x" | "y"; largeur: number } | null>(null);

  /** Le voisin dans la direction du doigt — `null` en bout de course : le monde ne boucle pas. */
  const voisinPour = (dx: number): IdRegion | null =>
    rang < 0 ? null : (ordre[rang + (dx < 0 ? 1 : -1)] ?? null);

  const onPointerDown = (e: React.PointerEvent) => {
    /* ⚠️ LA SOURIS EST EXCLUE, ET C'EST UNE DÉCISION. Un glissement à la souris avalerait la
       SÉLECTION DE TEXTE — dans une conversation qu'on veut pouvoir citer, c'est une perte nette.
       Le doublage non-spatial (la barre) reste le chemin de tout le monde : ce geste n'ouvre
       aucune destination qui n'ait déjà un lien nommé (UX-DR-37). */
    if (e.pointerType === "mouse" || !e.isPrimary) return;
    /* Le seuil se franchit par sa porte. Le glisser reviendrait à rouvrir le contournement qu'on
       vient de fermer : `rang < 0` là-bas, donc rien à faire. */
    if (rang < 0) return;
    if ((e.target as Element | null)?.closest?.("[data-sans-glissement]")) return;
    geste.current = { x0: e.clientX, y0: e.clientY, axe: "?", largeur: window.innerWidth };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = geste.current;
    if (!g) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (g.axe === "?") {
      if (Math.abs(dx) < AXE_TRANCHE && Math.abs(dy) < AXE_TRANCHE) return;
      /* ⚠️ L'AXE SE TRANCHE UNE FOIS, ET NE SE REJUGE PLUS. Sans ça, un défilement vertical un peu
         oblique bascule la région au milieu d'une lecture. `touch-action: pan-y` laisse en plus le
         navigateur faire défiler lui-même : les deux gestes ne se disputent jamais le même doigt. */
      g.axe = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (g.axe === "y") {
        geste.current = null;
        return;
      }
    }
    const vers = voisinPour(dx);
    /* En bout de course, le monde RÉSISTE (quart de course) au lieu de boucler : le geste répond,
       et il dit en même temps qu'il n'y a rien de ce côté. */
    setGlisse({ de: region, vers, dx: vers ? dx : dx * 0.25, fin: false });
  };

  const onPointerFin = (e: React.PointerEvent) => {
    const g = geste.current;
    geste.current = null;
    if (!g || g.axe !== "x") {
      setGlisse(null);
      return;
    }
    const dx = e.clientX - g.x0;
    const vers = voisinPour(dx);
    const franchi = vers !== null && Math.abs(dx) >= FRANCHISSEMENT;
    const cote = vers && ordre.indexOf(vers) > rang ? 1 : -1;
    setGlisse({ de: region, vers, dx: franchi ? -cote * g.largeur : 0, fin: true });
  };

  /**
   * ── LA FIN DU GESTE, ET POURQUOI LA BASCULE ARRIVE EN DERNIER ────────────────────────────────
   *
   * ⚠️ BASCULER LA RÉGION AU RELÂCHEMENT FAISAIT DISPARAÎTRE D'UN COUP LE PANNEAU QUI PART. Dès
   * que la destination devient la région courante, celle d'où l'on vient n'est plus
   * `.regionActive` : son opacité tombe à 0 — instantanément, puisque `.enGlissement` coupe les
   * transitions. On voyait donc l'écran quitté S'ÉTEINDRE sur place pendant que le nouveau
   * terminait sa course tout seul. Le geste avait l'air de casser à l'endroit précis où il devait
   * se conclure. Trouvé par le TÉMOIN d'une garde (« l'animation de fin n'a jamais été observée à
   * deux panneaux »), pas par l'assertion qu'elle portait.
   *
   * La bascule attend donc la fin de la course. Pendant tout le mouvement, les deux panneaux sont
   * pleinement opaques et collés ; à l'arrivée seulement, l'état change — sous `transition: none`,
   * puis on laisse DEUX TRAMES au navigateur pour peindre cet état avant de retirer `.enGlissement`.
   * Sans ces deux trames, la région quittée récupérerait sa transition d'opacité et se rallumerait
   * une fraction de seconde au centre de l'écran.
   */
  useEffect(() => {
    if (!glisse?.fin) return;
    const bref = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let a = 0;
    let b = 0;
    const t = window.setTimeout(
      () => {
        if (glisse.vers && glisse.dx !== 0) aller(glisse.vers);
        a = requestAnimationFrame(() => {
          b = requestAnimationFrame(() => setGlisse(null));
        });
      },
      bref ? 0 : DUREE_FIN,
    );
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
    /* Dépendance sur `glisse` SEUL, délibérément : `aller` est recréé à chaque rendu, et le
       mettre ici relancerait la minuterie à chaque frappe dans la conversation. */
  }, [glisse]);

  /**
   * Où chaque région est peinte pendant le geste.
   *
   * ⚠️ CALCULÉ SUR `glisse.de`, JAMAIS SUR LA RÉGION COURANTE. La bascule a lieu AU RELÂCHEMENT,
   * avant la fin de l'animation : à partir de cet instant, `region` vaut déjà la destination.
   * Repartir de `region` ferait sauter les deux panneaux d'une largeur d'écran au milieu du
   * mouvement — le défaut exact que ce champ existe pour éviter.
   */
  const positionDe = (id: IdRegion): CSSProperties | undefined => {
    if (!glisse) return undefined;
    const transition = glisse.fin ? `transform ${DUREE_FIN}ms var(--courbe)` : "none";
    if (id === glisse.de) return { transform: `translateX(${glisse.dx}px)`, transition };
    if (id === glisse.vers) {
      const cote = ordre.indexOf(id) > ordre.indexOf(glisse.de) ? 1 : -1;
      return { transform: `translateX(calc(${cote * 100}% + ${glisse.dx}px))`, transition };
    }
    return undefined;
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
        setProjLocale((p) => ({
          ...p,
          branches: p.branches.map((b) =>
            b.id === brancheId ? { ...b, nom } : b,
          ),
        }));
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
  const declarerRayonnement = async (
    brancheId: string,
  ): Promise<ResultatGeste> => {
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
          branches: p.branches.map((b) =>
            b.id === brancheId ? { ...b, etat: "rayonnement" as const } : b,
          ),
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
    <main
      className={s.monde}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerFin}
      onPointerCancel={onPointerFin}
    >
      {/* Surimpression persistante (Story 1.8) — EN TÊTE du DOM (hors régions inert) : la porte
          de secours est parmi les tout premiers arrêts de tabulation (AC3). Couche constante,
          jamais dans une région → jamais masquée/dissoute au changement de région (AC1). Le
          MODÈLE décide quoi porter (surimpressionPour) ; ce rendu ne fait que dessiner (AD-7). */}
      <Surimpression
        modele={surimpressionPour(
          region,
          projection.abonnementGerable === true,
        )}
        prepare={anamPrepare}
      />

      {/* Fond persistant — la scène est une, seul le premier plan se fond. */}
      <div className={s.ciel} aria-hidden>
        <div className={s.lune} />
      </div>
      <Etoiles />

      {/* Le DÉCOR de fond (ambiance, aria-hidden) — un arbre calme derrière toute la scène. L'arbre RÉEL et
          adressable (branches, fiche, pan/zoom) vit dans la région « arbre ». AD-7 : décor muet, sans donnée.

          ⚠️ LE FONDU D'ENTRÉE VIT SUR L'ENFANT, ET C'EST LA CORRECTION D'UN DÉFAUT MESURÉ. Les deux
          classes étaient portées par le MÊME élément : `imagerie` y déclare
          `opacity: var(--imagerie-opacite)`, `fondu-image` y anime l'opacité de 0 à 1 en
          `fill: both`. Une animation l'emporte sur une déclaration, et son dernier keyframe reste
          appliqué pour toujours : le jeton était donc MORT sur cet élément-ci, et sur lui seul.
          Mesuré en mode contraste renforcé (2026-08-19) : jeton à 0, lune et étoiles en
          `display: none` — et l'arbre à opacité 1. La règle était écrite, elle ne s'appliquait pas.
          Séparées sur deux éléments, les deux opacités se MULTIPLIENT : l'entrée se fond toujours,
          et le jeton gouverne à nouveau. */}
      {projection.tronc.present && (
        <div
          className={`${s.arbreMonde} ${region === "seuil" ? s.arbreAuSeuil : ""} ${
            region === "accueil" ? s.arbreEnRetrait : ""
          } imagerie`}
          aria-hidden
        >
          <div className="fondu-image">
            <ArbreVivant />
          </div>
        </div>
      )}

      <div className={s.grain} aria-hidden />

      {/* ─────────── Région : le seuil (le rideau se lève) ─────────── */}
      <section
        className={`${s.region} ${s.seuil} ${
          projection.tronc.present ? "" : s.seuilSansArbre
        } ${seuilActif ? s.regionActive : ""}`}
        aria-label="Seuil"
        aria-hidden={seuilActif ? undefined : true}
        inert={seuilActif ? undefined : true}
      >
        {/* ⚠️ IL N'Y A PLUS QU'UNE SEULE IMAGE ICI, ET C'EST LA CORRECTION D'UN DÉFAUT MESURÉ.
            `anam-seuil.png` était composité SOUS le texte : mesuré à 390 × 664, sa boîte occupait
            (0, 329)–(226, 624) — c'est-à-dire exactement celle du titre, de la phrase et de la
            porte, qui se lisaient donc sur son visage, tandis que le décor de l'arbre (250–422)
            la traversait par le haut. Deux illustrations empilées sur un tiers d'écran.

            Et le fichier n'était pas un personnage détouré : c'est une PEINTURE ENTIÈRE, avec son
            propre ciel étoilé, sa propre lune et sa propre voie lactée, posée sur le ciel étoilé
            de la scène. D'où le masque plumeux de la QA T9 — un emplâtre qui dissolvait un
            rectangle dans une nuit qu'il dupliquait. `presence/` et `veille/` prouvent que le
            détourage était possible (leur pourtour est transparent) ; ce fichier-ci ne l'a jamais
            eu.

            L'image du seuil est donc l'ARBRE, qui est l'objet du produit, qui est procédural (donc
            net à toute densité), et qui n'apporte pas un second ciel. Le personnage reste dans
            `public/scene/` : il n'est pas supprimé, il n'est plus empilé. */}
        <div className={s.seuilTexte}>
          <h1
            className="t-display"
            tabIndex={-1}
            ref={(el) => void (entetes.current.seuil = el)}
          >
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

          {/* ⚠️ LE SEUIL NE PRÉSENTE PAS LE LIEU, ET C'EST UNE MESURE QUI L'A DÉCIDÉ. La première
              version de H4 posait la présentation ICI, entre la phrase et la porte. Sur iPhone 14
              (390 × 664), le seuil dispose de 512 px utiles une fois les réserves de surimpression
              et de barre retirées ; l'identité et la porte en prennent déjà 300. Mesuré : contenu
              à 894 px pour 664, et « entrer dans le monde » ENTIÈREMENT hors du viewport — ratio 0.
              Quelqu'un qui arrivait voyait une présentation et aucune porte.

              La contrainte n'était pas un accident de copie : un seuil est fait pour être
              traversé, pas lu. La présentation vit donc dans l'accueil, où elle est lue avec les
              trois noms visibles dans la barre juste en dessous — et où l'on peut y aller. */}
          <button
            className={s.affordance}
            type="button"
            onClick={() => aller("accueil")}
          >
            <span className="t-bouton">entrer dans le monde</span>
          </button>
        </div>
      </section>

      {/* ─────────── Régions : les destinations, DÉRIVÉES du modèle (ordre + libellés) ─────────── */}
      {REGIONS.map((r) => {
        const actif = region === r.id;
        const classe =
          r.id === "anam"
            ? s.regionConversation
            : r.id === "arbre"
              ? s.regionArbre
              : s.panneau;
        return (
          <section
            key={r.id}
            className={`${s.region} ${classe} ${actif ? s.regionActive : ""} ${
              glisse && r.id === glisse.vers ? s.regionVoisine : ""
            }`}
            style={positionDe(r.id)}
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
                {echangeExtrait && (
                  <EchangeSource
                    extraitSourceId={echangeExtrait}
                    onRetour={retourArbre}
                  />
                )}
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
                  onOuvrirFiche={(id) =>
                    dispatch({ type: "ouvrirFiche", brancheId: id })
                  }
                  onFermerFiche={() => dispatch({ type: "fermerFiche" })}
                  onVoirDansConversation={voirDansConversation}
                  onRenommer={renommer}
                  onDeclarerRayonnement={declarerRayonnement}
                />
              </>
            ) : (
              <div className={s.bloc}>
                {/* h1 par région : une seule est non-inert à la fois → une seule h1 exposée. */}
                <h1
                  className="t-titre"
                  tabIndex={-1}
                  ref={(el) => void (entetes.current[r.id] = el)}
                >
                  {r.nom}
                </h1>
                {/* Story 5.6 — la bibliothèque remplace le texte d'attente. Une lecture en panne
                    (`null`) laisse la région vide plutôt que de fermer la scène (AC7). */}
                {r.id === "accueil" ? (
                  <>
                    {/* H4 — la présentation du lieu, en tête et une seule fois. Au-dessus des
                        cartes parce que c'est ce qu'elle explique : quatre d'entre elles sont
                        encore vides, et sans un mot ça se lit comme une panne. Ce n'est PAS une
                        carte — elle n'entre pas dans la grille et ne compte pas dans UX-DR-30,
                        qui borne les objets de bibliothèque. */}
                    <PremierPassage
                      modele={
                        premierPassage ?? {
                          du: false,
                          desCartesAttendent: false,
                        }
                      }
                      classe={s.passage}
                      classeListe={s.passagePlaces}
                      classeNote={s.passageNote}
                      classeLien={s.passageLien}
                    />
                    {bibliotheque ? (
                      <Bibliotheque bibliotheque={bibliotheque} />
                    ) : null}
                  </>
                ) : (
                  <p className="t-corps">{CORPS[r.id]}</p>
                )}
              </div>
            )}
          </section>
        );
      })}

      {/* Doublage non-spatial de rang égal (UX-DR-37) : mêmes liens nommés partout,
          barre basse en sm/md, rail à gauche en ≥ lg. Aucun cadenas/badge/compteur.

          ⚠️ SAUF AU SEUIL, ET CE N'EST PAS UNE ENTORSE À UX-DR-37. Le doublage non-spatial DOUBLE
          une navigation spatiale ; le seuil n'en a pas — il a une porte, et une seule. La barre y
          offrait les trois destinations SOUS le bouton qui prétend y mener : la porte était
          facultative, le rideau se contournait, et l'écran ne pouvait pas se lire comme un seuil.
          Le doublage reprend dès la première région, c'est-à-dire dès qu'il y a quelque chose à
          doubler. */}
      {!seuilActif && (
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
      )}
    </main>
  );
}
