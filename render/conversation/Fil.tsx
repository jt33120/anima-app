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
import CarteTiree from "../lecture/CarteTiree";
import Restitution from "../lecture/Restitution";
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
/**
 * LE SIGNE DE VIE PENDANT L'ATTENTE (Story 6.9, QA T13).
 *
 * ── LE DÉFAUT MESURÉ ───────────────────────────────────────────────────────────────────────────
 *
 * Le tour de QA a relevé « 7,4 s sans le moindre signe de vie ». Ce n'était pas tout à fait vrai :
 * un signe existe depuis la 2.2 — le glyphe d'Anam ÉPAISSIT son trait dans la surimpression. Mais
 * il fait 20 px, il passe de 1,5 à 2,75 px d'épaisseur, et il est EN HAUT DE L'ÉCRAN. Elle vient
 * d'appuyer sur « Envoyer » : elle regarde le bas.
 *
 * Le signal était donc au bon endroit pour le produit, et au mauvais endroit pour elle.
 *
 * ── CE QUI N'A PAS CHANGÉ, ET NE DOIT PAS ──────────────────────────────────────────────────────
 *
 * ⚠️ AUCUNE ANIMATION CYCLIQUE. « Jamais trois points qui rebondissent » est une décision de la
 * Story 2.2, pas un détail de style : un indicateur nerveux dit « la machine calcule ». Ici on
 * répète le MÊME geste (le trait s'épaissit, une fois) à l'endroit où l'oeil se trouve. Le glyphe
 * PARAÎT — et le fait qu'il soit apparu EST le signe.
 */
function AnamPrepare() {
  return (
    <div className={`${s.attente} fondu-texte`} aria-hidden>
      <svg className={s.attenteSigne} viewBox="0 0 24 24" focusable="false">
        <path d="M12 22 V7" />
        <path d="M12 12.5 L7 8.5" />
        <path d="M12 14.5 L17 9.5" />
      </svg>
    </div>
  );
}

export default function Fil({
  tours,
  annonce,
  prepare = false,
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
  /** Story 6.9 (QA T13) — Anam prépare : le signe paraît EN BAS DU FIL, là où elle regarde. */
  prepare?: boolean;
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

  /**
   * ── UN DÉFILEMENT QUE NOUS PROVOQUONS NE DIT RIEN DE SON INTENTION (QA tour 2, BLOQUANT) ──────
   *
   * `etaitEnBas` répond à une seule question : « veut-elle suivre la conversation ? ». Seul SON
   * geste peut y répondre. Or le navigateur émet le même évènement `scroll` pour son doigt et pour
   * notre `scrollIntoView` — et le gestionnaire ci-dessous les lisait pareil.
   *
   * Conséquence mesurée : le filet de détresse amène le bloc de ressources dans le champ (l'unique
   * exception nommée plus bas) ; ce bloc n'étant pas tout en bas du fil, `estAncreEnBas` devient
   * FAUX, et le suivi ne se rallume plus JAMAIS. Tout ce qu'elle écrit ensuite, et tout ce qu'Anam
   * répond ensuite, naît hors de l'écran sans que rien ne bouge. Mesuré : `scrollTop` figé à 341 px
   * alors que le témoin sans détresse suivait 0 → 130 → 388.
   *
   * ⚠️ LE CORRECTIF DE LA 6.9 AVAIT DONC CRÉÉ PIRE QUE CE QU'IL RÉPARAIT — au moment le plus
   * délicat du produit, et seulement là. C'est la deuxième famille de défauts du dépôt : le défaut
   * vit dans l'intervalle, ici entre une story et son propre correctif.
   */
  const defilementProgramme = useRef(false);
  const marquerNotreDefilement = () => {
    defilementProgramme.current = true;
    // ⚠️ DEUX FILETS, ET LE PREMIER EST LE BON. Le gestionnaire relâche la garde dès qu'il a avalé
    // l'évènement qu'on attendait : la fenêtre d'aveuglement dure donc UN évènement, pas un délai.
    // Sans ce détail, une garde ouverte deux trames pourrait avaler SON geste à elle si elle défile
    // dans les ~32 ms qui suivent l'arrivée d'un tour — c'est-à-dire rendre le suivi captif, ce que
    // la règle non captive de la 2.2 refuse. Le second filet (les deux trames) ne sert qu'au cas où
    // AUCUN évènement n'arrive — un défilement programmé qui ne déplace rien n'en émet pas.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        defilementProgramme.current = false;
      });
    });
  };

  useEffect(() => {
    const el = conteneur.current;
    if (!el) return;
    const surScroll = () => {
      if (defilementProgramme.current) {
        defilementProgramme.current = false;
        return;
      }
      etaitEnBas.current = estAncreEnBas(el);
    };
    el.addEventListener("scroll", surScroll, { passive: true });
    return () => el.removeEventListener("scroll", surScroll);
  }, []);

  // À chaque nouveau contenu : recoller au bas UNIQUEMENT si on y était (défilement instantané,
  // jamais « smooth » → cohérent reduced-motion, et non captif).
  //
  // ⚠️ `prepare` EST DANS LES DÉPENDANCES (Story 6.9) : le signe d'attente s'insère en fin de fil et
  // ajoute de la hauteur. Sans ce recalage, il naîtrait juste sous le bord visible — c'est-à-dire
  // invisible, exactement le défaut qu'il vient corriger.
  useEffect(() => {
    const el = conteneur.current;
    if (el && etaitEnBas.current) {
      marquerNotreDefilement();
      el.scrollTop = el.scrollHeight;
    }
  }, [tours, prepare]);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // LE FILET DE DÉTRESSE VIENT À ELLE — LA SEULE EXCEPTION AU SUIVI NON CAPTIF (6.9, QA T26)
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // Le suivi du bas est NON CAPTIF depuis la 2.2 (AC3) : si elle a remonté le fil, on ne la ramène
  // pas. C'est une bonne règle, et elle a exactement UN cas où elle nuit.
  //
  // Le tour de QA a mesuré qu'au moment de la détresse, le fil ne fait que 307 px dans une fenêtre
  // de 742 : le bloc de ressources — trois numéros et leurs descriptions — ne tient pas dedans. S'il
  // s'insère alors qu'elle n'est pas ancrée en bas, il paraît HORS DU CHAMP. Le filet est là, et
  // personne ne le voit.
  //
  // AD-9/AD-15 tranchent : le filet doit ATTEINDRE. On amène donc le bloc de ressources dans le
  // champ, quoi qu'il arrive — et rien d'autre. Ce n'est pas un assouplissement de la règle, c'est
  // son unique exception, nommée.
  const ressourceRef = useRef<HTMLDivElement>(null);
  const derniereRessource = useRef<string | null>(null);
  useEffect(() => {
    const dernier = [...tours].reverse().find((t) => t.role === "ressource");
    if (!dernier || dernier.id === derniereRessource.current) return;
    derniereRessource.current = dernier.id;
    // `block: "nearest"` : on l'amène dans le champ SANS recentrer la page — elle n'est pas
    // déplacée plus que nécessaire. Jamais « smooth » : cohérent reduced-motion, comme tout le fil.
    marquerNotreDefilement();
    ressourceRef.current?.scrollIntoView({ block: "nearest" });
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
          // L'ancre du filet : `scrollIntoView` la vise à l'insertion (voir l'encadré T26 ci-dessus).
          <div key={t.id} ref={ressourceRef}>
            <BlocRessources ressources={t.ressources} verifieLe={t.verifieLe} />
          </div>
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
        ) : t.role === "carte" ? (
          // Story 5.8 — la carte se dépose. Aucune animation d'entrée : « la carte est déjà là ».
          // La `key` porte l'id du TOUR, pas la clé de carte : deux lectures successives sur la même
          // carte (c'est possible, le tirage est uniforme) doivent être deux tours distincts, sinon
          // React réutilise le nœud et la seconde n'apparaît jamais (le piège de la 4.6).
          <CarteTiree
            key={t.id}
            carte={{
              cle: t.cle,
              description: t.description === null ? { statut: "non_ecrit" } : { statut: "ecrit", texte: t.description },
            }}
          />
        ) : t.role === "lecture" ? (
          // Ses mots ne sont pas repris ici : son propre tour est juste au-dessus dans le fil. Ils le
          // sont dans « Mes lectures », où il n'y a plus de fil autour (FR-021).
          <Restitution key={t.id} texte={t.texte} />
        ) : (
          <TourUtilisatrice key={t.id} texte={t.texte} />
        ),
      )}
      {/* Story 6.9 (QA T13) — EN DERNIER, après tous les tours : c'est là que la réponse va naître. */}
      {prepare && <AnamPrepare />}
      {/* Région d'annonce a11y — hors flux visuel, remplie UNE fois à la fin (message complet). */}
      <p className={s.annonce} aria-live="polite" aria-atomic="true">
        {annonce}
      </p>
    </div>
  );
}
