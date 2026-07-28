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

  // Beat « ouverture » câblé au montage (AC6). « nommer »/« clôture » = seams 2.7/2.9.
  const [beat] = useState<Beat>("ouverture");

  const shell = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLTextAreaElement>(null);
  // Historique envoyé PAR tour d'Anam (id → messages) : « Réessayer » rejoue le BON tour, pas le
  // dernier envoi global (revue 2.2). Éphémère en session.
  const envoisParTour = useRef<Map<string, MessageEnvoi[]>>(new Map());

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
      });
    },
    [envoyer],
  );

  const surEnvoi = useCallback(
    (texte: string) => {
      const histo: MessageEnvoi[] = tours
        // Garde de type : le bloc `ressource` (sans `texte`) n'entre jamais dans l'historique envoyé.
        .filter(
          (t): t is Exclude<Tour, { role: "ressource" }> =>
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
      // Retire le tour d'Anam ET tout bloc ressources rattaché (ancreId) — sinon le rejeu laisserait un
      // bloc orphelin et en insérerait un second (double 15/112 en urgence — revue 2.6, R2).
      setTours((prev) =>
        prev.filter((t) => t.id !== idAnam && !(t.role === "ressource" && t.ancreId === idAnam)),
      );
      lancer(messages);
      // Le bouton « Réessayer » vient d'être démonté : redéplacer le focus vers le composeur, jamais
      // le laisser retomber sur <body> (WCAG 2.4.3).
      requestAnimationFrame(() => champRef.current?.focus());
    },
    [lancer],
  );

  return (
    <div className={s.conversation} ref={shell}>
      <ApparitionAnam beat={beat} />
      <Fil tours={tours} annonce={annonce} onReessayer={reessayer} />
      <Composeur onEnvoyer={surEnvoi} occupe={enCours} champRef={champRef} />
    </div>
  );
}
