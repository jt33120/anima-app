"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ApparitionAnam, { type Beat } from "./ApparitionAnam";
import Composeur from "./Composeur";
import Fil from "./Fil";
import { useFluxAnam, type MessageEnvoi } from "./useFluxAnam";
import { insererTour } from "./fil-ops";
import type { Tour } from "./types";
import s from "./conversation.module.css";

/**
 * Conversation — l'orchestrateur de la VUE conversation (Story 2.2, B2→B5). Rendu de la région
 * `anam` (AD-7 : adaptateur MUET — aucune règle de domaine ici, ni arc, ni sécurité, ni monotonie ;
 * il ne connaît que `fetch` vers `app/api` via `useFluxAnam`). Le cerveau d'Anam (arc 2.7, voix 2.8,
 * sécurité 2.3) vient après : en 2.2, l'échange se démontre via l'adaptateur factice.
 *
 * Tours ÉPHÉMÈRES en session (aucune table de conversation — persistance = Epic 4, AD-8). Le tour
 * de l'utilisatrice s'affiche immédiatement (optimiste) et n'est JAMAIS retiré (même en cas d'échec).
 *
 * `onPreparation` remonte l'état « Anam prépare » au SceneDom → qui épaissit le signe de la
 * surimpression persistante (AC2). Le fil reste muet ; c'est le signe qui porte la préparation.
 */

// Ids stables en session (jamais Math.random/Date au rendu → aucun mismatch d'hydratation).
let compteur = 0;
const nouvelId = () => `t${++compteur}`;

// Registre SYSTÈME (jamais signé Anam) — même texte que le tour en échec, pour l'annonce a11y.
const MESSAGE_ECHEC = "Je n’ai pas pu répondre. Ton message est gardé.";

export default function Conversation({ onPreparation }: { onPreparation?: (prepare: boolean) => void }) {
  const [tours, setTours] = useState<Tour[]>([]);
  const [annonce, setAnnonce] = useState("");
  const { prepare, enCours, envoyer } = useFluxAnam();

  // Beat « ouverture » monté au démarrage (2.2, AC6) ; « nommer » piloté par l'arc de séance (2.7,
  // via onBeat) ; « cloture » = seam 2.9. Passif : l'apparition ne vole jamais le focus au composeur.
  const [beat, setBeat] = useState<Beat>("ouverture");

  const shell = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLTextAreaElement>(null);
  // Historique envoyé PAR tour d'Anam (id → messages) : « Réessayer » rejoue le BON tour, pas le
  // dernier envoi global (revue 2.2). Éphémère en session.
  const envoisParTour = useRef<Map<string, MessageEnvoi[]>>(new Map());
  // « Pas maintenant » (3.2, AC5/FR-057) : une SEULE sollicitation par session. Le fil est éphémère
  // (aucune persistance — Epic 4), et la trame `paywall` n'est émise qu'une fois (beat cloture
  // idempotent) → la sollicitation unique est structurellement tenue ; ce verrou est la ceinture
  // (si la trame se re-présentait, aucune ré-insertion). La persistance serveur du refus est différée.
  const abonnementRefuse = useRef(false);

  // Remonte « Anam prépare » au SceneDom (→ signe épaissi). Effet, pas de setState pendant le rendu.
  useEffect(() => {
    onPreparation?.(prepare);
  }, [prepare, onPreparation]);

  // Clavier virtuel mobile (AC8) : `dvh` seul ne suffit pas (Chromium ne rétrécit pas les unités
  // viewport à l'ouverture du clavier). On lit `visualViewport` (resize + scroll) et on expose le
  // décalage en var CSS → le composeur remonte au-dessus du clavier. Repli : rien si absent (dvh).
  useEffect(() => {
    const vv = window.visualViewport;
    const el = shell.current;
    if (!vv || !el) return;
    const maj = () => {
      const decalage = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      el.style.setProperty("--decalage-clavier", `${decalage}px`);
    };
    maj();
    vv.addEventListener("resize", maj);
    vv.addEventListener("scroll", maj);
    return () => {
      vv.removeEventListener("resize", maj);
      vv.removeEventListener("scroll", maj);
    };
  }, []);

  const lancer = useCallback(
    (messages: MessageEnvoi[]) => {
      const idAnam = nouvelId();
      // Id du bilan de CE tour (ancre de la carte d'abonnement 3.2). Capturé dans la même clôture que
      // les rappels de flux → `onPaywall` insère la carte sous le bon bilan, sans état partagé.
      let idBilanCourant: string | null = null;
      envoisParTour.current.set(idAnam, messages);
      setTours((prev) => [...prev, { id: idAnam, role: "anam", texte: "", etat: "flux" }]);
      setAnnonce("");
      void envoyer(messages, {
        onMotsReveles: (mots) =>
          setTours((prev) =>
            prev.map((t) =>
              t.id === idAnam && t.role === "anam" ? { ...t, texte: t.texte + mots } : t,
            ),
          ),
        onFin: (complet) => {
          setTours((prev) =>
            prev.map((t) =>
              t.id === idAnam && t.role === "anam" ? { ...t, texte: complet, etat: "complet" } : t,
            ),
          );
          setAnnonce(complet); // annonce a11y UNIQUE (aria-atomic), à la fin — SUCCÈS
        },
        onEchec: () => {
          setTours((prev) =>
            prev.map((t) => (t.id === idAnam && t.role === "anam" ? { ...t, etat: "echec" } : t)),
          );
          setAnnonce(MESSAGE_ECHEC); // l'ÉCHEC aussi est annoncé au lecteur d'écran (revue 2.2)
        },
        // Bloc ressources de détresse (2.6, AC4) : le SERVEUR décide le placement (avant/après le tour
        // d'Anam) ; on insère passivement, sans jamais déplacer le focus (le composeur reste au focus).
        // Ancré à `idAnam` → « Réessayer » les purge ensemble (R2). Annonce POLIE de son arrivée au
        // lecteur d'écran (R3) — sinon le filet de secours est inséré muet pour l'AT.
        onRessources: (position, ressources, verifieLe) => {
          const idRes = nouvelId();
          setTours((prev) =>
            insererTour(prev, idAnam, position, {
              id: idRes,
              role: "ressource",
              ancreId: idAnam,
              ressources,
              verifieLe,
            }),
          );
          setAnnonce("Des ressources d’aide sont affichées.");
        },
        // Beat d'apparition (2.7) : Anam paraît en Présence au moment décidé par l'arc (serveur).
        // Passif — jamais de vol de focus (le composeur reste actif).
        onBeat: (b) => setBeat(b),
        // Bilan de clôture (2.9, AC2) : le SERVEUR a structuré le bilan (titre + points) et l'émet dans
        // le MÊME flux, avant `fin`. Bloc document inséré APRÈS le tour d'Anam, dans le fil (jamais une
        // modale). Passif — ne vole pas le focus (le composeur reste actif). Annonce polie au lecteur d'écran.
        onBilan: (titre, points) => {
          const idBilan = nouvelId();
          idBilanCourant = idBilan; // ancre de POSITION de la carte d'abonnement (3.2)
          setTours((prev) =>
            insererTour(prev, idAnam, "apres", { id: idBilan, role: "bilan", ancreId: idAnam, titre, points }),
          );
          setAnnonce("Le bilan de la séance est affiché.");
        },
        // Proposition d'abonnement (3.2, AC1) : le SERVEUR a décidé de proposer (trame `paywall`,
        // retenue en détresse/premium — AD-9). On insère la carte SOUS le bilan. Passive : ne vole
        // jamais le focus (le composeur reste actif) et ne s'annonce pas (l'annonce du bilan prime ;
        // la carte reste navigable). Ne se réinsère pas si l'utilisatrice a déjà dit « Pas maintenant ».
        onPaywall: () => {
          if (abonnementRefuse.current || !idBilanCourant) return; // refus session, ou pas de bilan-ancre
          const ancre = idBilanCourant;
          const idPaywall = nouvelId();
          // Position : SOUS le bilan (`ancre`). `ancreId: idAnam` = le tour producteur → « Réessayer »
          // purge la carte avec lui (jamais une carte orpheline doublée au rejeu, comme le bloc ressource).
          setTours((prev) => insererTour(prev, ancre, "apres", { id: idPaywall, role: "paywall", ancreId: idAnam }));
        },
      });
    },
    [envoyer],
  );

  const surEnvoi = useCallback(
    (texte: string) => {
      const histo: MessageEnvoi[] = tours
        // Garde de type : seuls les tours PORTEURS DE TEXTE entrent dans l'historique envoyé. Les blocs
        // `ressource` et `bilan` (2.9, sans `texte`) en sont exclus — par le rôle, pas juste par Exclude.
        .filter(
          (t): t is Extract<Tour, { role: "utilisatrice" | "anam" }> =>
            t.role === "utilisatrice" || (t.role === "anam" && t.etat === "complet"),
        )
        .map((t) => ({ role: t.role === "utilisatrice" ? "user" : "assistant", content: t.texte }));
      setTours((prev) => [...prev, { id: nouvelId(), role: "utilisatrice", texte }]);
      lancer([...histo, { role: "user", content: texte }]);
    },
    [tours, lancer],
  );

  // « Réessayer » CE tour précis : retire seulement le tour d'Anam en échec `idAnam` (les partiels
  // des AUTRES échecs restent dans le fil — revue 2.2) et rejoue l'historique de CE tour. En 2.2 la
  // clé d'idempotence du métrage est serveur (par requête) → un retry recompte ; la déduplication
  // d'un retour client (jeton de tour stable) est différée. [deferred-work.md]
  const reessayer = useCallback(
    (idAnam: string) => {
      const messages = envoisParTour.current.get(idAnam);
      if (!messages) return;
      envoisParTour.current.delete(idAnam);
      // Retire le tour d'Anam ET tout bloc rattaché par `ancreId` (ressources 2.6, bilan + carte 3.2) —
      // sinon un tour de clôture qui échoue APRÈS avoir émis bilan/carte laisserait ceux-ci orphelins, et
      // le rejeu en insérerait un SECOND (double bilan / double paywall — même patron que le double 15/112,
      // revue 2.6 R2 / 3.2).
      setTours((prev) =>
        prev.filter(
          (t) =>
            t.id !== idAnam &&
            !((t.role === "ressource" || t.role === "bilan" || t.role === "paywall") && t.ancreId === idAnam),
        ),
      );
      lancer(messages);
      // Le bouton « Réessayer » vient d'être démonté : redéplacer le focus vers le composeur, jamais
      // le laisser retomber sur <body> (WCAG 2.4.3).
      requestAnimationFrame(() => champRef.current?.focus());
    },
    [lancer],
  );

  // « Pas maintenant » (3.2, AC5) : retire la carte, arme le verrou d'unique sollicitation, et
  // redéplace le focus vers le composeur (le bouton retiré ne doit jamais laisser le focus sur <body>,
  // WCAG 2.4.3). L'abonnement reste ensuite atteignable depuis le menu de compte (surface différée).
  const refuserAbonnement = useCallback((id: string) => {
    abonnementRefuse.current = true;
    setTours((prev) => prev.filter((t) => t.id !== id));
    requestAnimationFrame(() => champRef.current?.focus());
  }, []);

  return (
    <div className={s.conversation} ref={shell}>
      <ApparitionAnam beat={beat} />
      <Fil tours={tours} annonce={annonce} onReessayer={reessayer} onRefuserAbonnement={refuserAbonnement} />
      <Composeur onEnvoyer={surEnvoi} occupe={enCours} champRef={champRef} />
    </div>
  );
}
