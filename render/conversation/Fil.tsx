"use client";

import { useEffect, useRef } from "react";
import TourAnam from "./TourAnam";
import TourUtilisatrice from "./TourUtilisatrice";
import BlocRessources from "./BlocRessources";
import BlocDocument from "./BlocDocument";
import CarteAbonnement from "./CarteAbonnement";
import PropositionBranche from "./PropositionBranche";
import InvitationIntegration from "./InvitationIntegration";
import HypotheseEnneagramme from "./HypotheseEnneagramme";
import { estAncreEnBas } from "./composeur-clavier";
import type { Tour } from "./types";
import s from "./conversation.module.css";

/**
 * Fil — le flux vertical unique de la conversation (Story 2.2, B2 ; AC1). SANS bulles opposées :
 * mêmes marges, distinction par la typographie + le filet (voir TourAnam/TourUtilisatrice).
 *
 * Suivi du bas NON CAPTIF (AC3) : on ne recolle au bas QUE si l'utilisatrice y était déjà (mesuré
 * au scroll). Dès qu'elle remonte, on cesse de la ramener — et on ne reprend pas seul.
 *
 * Annonce lecteur d'écran UNIQUE et à la FIN (AC3) : la région `aria-live="polite"` +
 * `aria-atomic="true"` reçoit le message COMPLET en une fois (jamais mot à mot). On NE se repose
 * PAS sur `aria-busy` (cassé sur NVDA, bug #1682063) : le texte qui « tape » vit hors de cette
 * région (dans le fil visuel), et seule la fin y écrit.
 */
export default function Fil({
  tours,
  annonce,
  onReessayer,
  onRefuserAbonnement,
  onRepondreProposition,
  onNommerBranche,
  onAllerVersBranche,
  onAllerVersHypothese,
  nommage,
  quotaEpuise,
}: {
  tours: Tour[];
  annonce: string;
  onReessayer?: (idAnam: string) => void;
  onRefuserAbonnement?: (id: string) => void;
  /** Story 4.5 — Oui/Non sur une proposition de branche, et le nommage (le nom donné par elle). */
  onRepondreProposition?: (id: string, signalId: string, oui: boolean) => void;
  onNommerBranche?: (id: string, signalId: string, nom: string) => void;
  /** Story 4.5 — l'état d'un « Nommer » en vol (#12 verrou d'envoi / #3 échec retryable). */
  nommage?: { id: string; etat: "envoi" | "echec" } | null;
  /** Story 4.10 (AC4) — l'invitation mène à la fiche de la branche visée, sinon c'est un reproche. */
  onAllerVersBranche?: (brancheId: string) => void;
  /** Story 5.5 (AC2) — l'hypothèse mène à la halte, là où les trois réponses ont la même lisibilité. */
  onAllerVersHypothese?: () => void;
  /** Story 3.4 (revue F9) : allocation épuisée → aucun « Réessayer » résiduel (un rejeu serait re-coupé). */
  quotaEpuise?: boolean;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const etaitEnBas = useRef(true);

  useEffect(() => {
    const el = conteneur.current;
    if (!el) return;
    const surScroll = () => {
      etaitEnBas.current = estAncreEnBas(el);
    };
    el.addEventListener("scroll", surScroll, { passive: true });
    return () => el.removeEventListener("scroll", surScroll);
  }, []);

  // À chaque nouveau contenu : recoller au bas UNIQUEMENT si on y était (défilement instantané,
  // jamais « smooth » → cohérent reduced-motion, et non captif).
  useEffect(() => {
    const el = conteneur.current;
    if (el && etaitEnBas.current) el.scrollTop = el.scrollHeight;
  }, [tours]);

  return (
    <div className={s.fil} ref={conteneur}>
      {tours.map((t) =>
        t.role === "anam" ? (
          <TourAnam
            key={t.id}
            texte={t.texte}
            etat={t.etat}
            onReessayer={
              t.etat === "echec" && onReessayer && !quotaEpuise ? () => onReessayer(t.id) : undefined
            }
          />
        ) : t.role === "ressource" ? (
          <BlocRessources key={t.id} ressources={t.ressources} verifieLe={t.verifieLe} />
        ) : t.role === "bilan" ? (
          <BlocDocument key={t.id} titre={t.titre} points={t.points} />
        ) : t.role === "paywall" ? (
          <CarteAbonnement key={t.id} onRefuser={() => onRefuserAbonnement?.(t.id)} />
        ) : t.role === "proposition-branche" ? (
          <PropositionBranche
            key={t.id}
            phrase={t.phrase}
            etat={t.etat}
            nom={t.nom}
            enCours={nommage?.id === t.id && nommage.etat === "envoi"}
            echec={nommage?.id === t.id && nommage.etat === "echec"}
            onOui={() => onRepondreProposition?.(t.id, t.signalId, true)}
            onNon={() => onRepondreProposition?.(t.id, t.signalId, false)}
            onNommer={(nom) => onNommerBranche?.(t.id, t.signalId, nom)}
          />
        ) : t.role === "invitation-integration" ? (
          <InvitationIntegration
            key={t.id}
            phrase={t.phrase}
            onAller={onAllerVersBranche ? () => onAllerVersBranche(t.brancheCibleId) : undefined}
          />
        ) : t.role === "hypothese-enneagramme" ? (
          <HypotheseEnneagramme key={t.id} phrase={t.phrase} onVoir={onAllerVersHypothese} />
        ) : (
          <TourUtilisatrice key={t.id} texte={t.texte} />
        ),
      )}
      {/* Région d'annonce a11y — hors flux visuel, remplie UNE fois à la fin (message complet). */}
      <p className={s.annonce} aria-live="polite" aria-atomic="true">
        {annonce}
      </p>
    </div>
  );
}
