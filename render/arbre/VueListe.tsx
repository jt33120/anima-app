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
import { LIBELLE_ETAT, ACTION_VOIR_CONVERSATION, ACTION_RENOMMER, VIDE_TITRE, VIDE_CORPS } from "./copie-arbre";
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
}

export default function VueListe({ branches, onVoirDansConversation, onRenommer, onAnnoncer }: ProprietesVueListe) {
  const [renomme, setRenomme] = useState<string | null>(null);
  // Le focus doit REVENIR au bouton qui a ouvert le champ : sans ça, refermer le renommage (succès ou
  // annulation) démonte l'élément focalisé et le focus retombe sur <body> — la navigation clavier
  // repart alors du début du document (re-revue).
  const boutonsRenommer = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const fermerRenommage = (id: string) => {
    setRenomme(null);
    requestAnimationFrame(() => boutonsRenommer.current.get(id)?.focus());
  };

  if (branches.length === 0) {
    return (
      <div className={s.vide}>
        <p className={s.videTitre}>{VIDE_TITRE}</p>
        <p className={s.videCorps}>{VIDE_CORPS}</p>
      </div>
    );
  }
  return (
    <ul className={s.liste}>
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
          </div>
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
