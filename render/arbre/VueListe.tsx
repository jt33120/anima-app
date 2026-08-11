"use client";

/*
 * VueListe — le doublage NON-SPATIAL de rang égal du canevas (UX-DR-37). Chaque branche y est listée en toutes
 * lettres : nom (voix utilisatrice), date, ÉTAT ÉCRIT (naissance / feuillaison / rayonnement — jamais porté par
 * la couleur seule), extrait. Atteignable au clavier et au lecteur d'écran sans traverser la scène.
 *
 * Revue 4.6 : « Renommer » ouvre désormais le champ EN PLACE (composant partagé avec la fiche). Auparavant il
 * appelait l'ouverture d'une fiche qui n'était rendue QUE dans la vue canevas → un utilisateur clavier ne
 * pouvait tout simplement pas renommer, et le « rang égal » d'AC8 était faux.
 */

import { useRef, useState } from "react";
import type { BrancheProjetee } from "@/lib/scene/projection";
import ChampRenommage from "./ChampRenommage";
import PlanEtapes from "./PlanEtapes";
import EtatVideArbre from "./EtatVideArbre";
import BoutonTronc from "./BoutonTronc";
import {
  LIBELLE_ETAT,
  ACTION_VOIR_CONVERSATION,
  ACTION_RENOMMER,
  PLAN_TITRE,
} from "./copie-arbre";
import s from "./arbre.module.css";

function dateLisible(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

export interface ProprietesVueListe {
  branches: readonly BrancheProjetee[];
  onOuvrir: (id: string) => void;
  onVoirDansConversation: (extraitSourceId: string) => void;
  onRenommer: (brancheId: string, nom: string) => Promise<boolean>;
  /** Dépose une annonce a11y dans la région live PERSISTANTE de la région arbre. */
  onAnnoncer?: (texte: string) => void;
  /** Story 4.10 (AC6) — l'écriture du plan est-elle ouverte ? Décidé SERVEUR, constaté ici. */
  planOuvert?: boolean;
  /** Story 3.3 (AC6) — la phrase sobre de l'état vide. Décidé par le modèle, constaté ici (AD-7). */
  direOuNaissentLesBranches?: boolean;
  /**
   * Story 5.3 — le chemin vers la fiche du tronc. Il est ICI pour la même raison que le plan d'étapes
   * l'est : la vue liste est le doublage NON SPATIAL DE RANG ÉGAL (UX-DR-37). Un chemin qui n'existerait
   * que sur le canevas serait inatteignable au clavier et au lecteur d'écran — le défaut exact que la
   * revue 4.6 a trouvé sur le renommage.
   */
  onOuvrirTronc?: () => void;
}

export default function VueListe({
  branches,
  onVoirDansConversation,
  onRenommer,
  onAnnoncer,
  planOuvert,
  direOuNaissentLesBranches,
  onOuvrirTronc,
}: ProprietesVueListe) {
  const [renomme, setRenomme] = useState<string | null>(null);
  /**
   * Story 4.10 — LE PLAN EST ATTEIGNABLE ICI AUSSI, et ce n'est pas du confort.
   *
   * La fiche n'est rendue QUE dans la vue canevas. Si le plan n'existait que là, quelqu'un qui navigue au
   * clavier ou au lecteur d'écran ne pourrait tout simplement pas s'en servir — c'est MOT POUR MOT le
   * défaut que la revue 4.6 a trouvé sur le renommage, et le « rang égal » d'UX-DR-37 redeviendrait faux.
   *
   * Ouvert À LA DEMANDE (comme le champ de renommage) plutôt que monté pour chaque branche : `PlanEtapes`
   * charge son plan au montage, et lister vingt branches déclencherait vingt requêtes pour du contenu
   * art. 9 que personne n'a demandé à lire (minimisation).
   */
  const [planOuvertPour, setPlanOuvertPour] = useState<string | null>(null);
  const boutonsPlan = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  // Le focus doit REVENIR au bouton qui a ouvert le champ : sans ça, refermer le renommage (succès ou
  // annulation) démonte l'élément focalisé et le focus retombe sur <body> — la navigation clavier
  // repart alors du début du document (re-revue).
  const boutonsRenommer = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const fermerRenommage = (id: string) => {
    setRenomme(null);
    requestAnimationFrame(() => boutonsRenommer.current.get(id)?.focus());
  };

  // AC2 [DUR] — LE MÊME composant que la vue canevas, jamais une seconde copie de l'écran vide.
  if (branches.length === 0) {
    return (
      <EtatVideArbre
        direOuNaissentLesBranches={direOuNaissentLesBranches}
        onOuvrirTronc={onOuvrirTronc}
      />
    );
  }
  return (
    <ul className={s.liste}>
      {/* Le tronc en tête : il porte l'arbre, il ouvre la liste. Absent quand rien ne manque (AC4). */}
      {onOuvrirTronc && (
        <li className={s.listeItem}>
          <BoutonTronc onOuvrir={onOuvrirTronc} />
        </li>
      )}
      {branches.map((b) => (
        <li key={b.id} className={s.listeItem}>
          <p className={s.ficheNom}>{b.nom ?? ""}</p>
          <p className={s.ficheDate}>
            {dateLisible(b.dateNaissance)}
            {" · "}
            {/* État EN TOUTES LETTRES (jamais la couleur seule, FR-031/a11y) */}
            <span>État : {LIBELLE_ETAT[b.etat]}</span>
          </p>
          {b.extraitContenu && <blockquote className={s.tourUtilisatrice}>{b.extraitContenu}</blockquote>}
          <div className={s.ficheActions}>
            <button
              type="button"
              className={s.actionSecondaire}
              onClick={() => onVoirDansConversation(b.extraitSourceId)}
            >
              {ACTION_VOIR_CONVERSATION}
            </button>
            {renomme !== b.id && (
              <button
                type="button"
                className={s.actionSecondaire}
                ref={(el) => void boutonsRenommer.current.set(b.id, el)}
                onClick={() => setRenomme(b.id)}
              >
                {ACTION_RENOMMER}
              </button>
            )}
            {/* Le bouton reste MONTÉ et bascule (revue 4.10) : le démonter au clic faisait disparaître
                l'élément focalisé — focus sur `<body>`, exactement le défaut que `fermerRenommage`
                corrige trois lignes plus haut. Et sans lui, le plan n'était plus refermable du tout. */}
            <button
              type="button"
              className={s.actionSecondaire}
              ref={(el) => void boutonsPlan.current.set(b.id, el)}
              aria-expanded={planOuvertPour === b.id}
              onClick={() => setPlanOuvertPour((ouvert) => (ouvert === b.id ? null : b.id))}
            >
              {PLAN_TITRE}
            </button>
          </div>
          {planOuvertPour === b.id && (
            <PlanEtapes key={b.id} brancheId={b.id} ouvert={planOuvert} onAnnoncer={onAnnoncer} />
          )}
          {renomme === b.id && (
            <ChampRenommage
              key={b.id}
              brancheId={b.id}
              onRenommer={onRenommer}
              onTermine={() => fermerRenommage(b.id)}
              onAnnoncer={onAnnoncer}
              autoFocus
            />
          )}
        </li>
      ))}
    </ul>
  );
}
