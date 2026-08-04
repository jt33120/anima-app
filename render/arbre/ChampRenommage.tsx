"use client";

/*
 * ChampRenommage — le champ VIDE par lequel elle redonne un nom à sa branche (UX-DR-27 : aucun nom
 * pré-rempli, aucune suggestion, aucun exemple — comme au nommage d'origine). Partagé par la FICHE et par la
 * VUE LISTE : sans ce partage, « Renommer » ne renommait rien pour un utilisateur clavier/lecteur d'écran,
 * et le « rang égal » d'AC8 était faux (revue 4.6).
 *
 * RE-REVUE — trois défauts corrigés ici, tous invisibles à la lecture de source :
 *  • le SUCCÈS ÉTAIT MUET : `setAnnonce(...)` puis `onTermine?.()` dans le même commit démontaient le nœud
 *    `aria-live` avant qu'il n'ait jamais porté le texte. L'annonce remonte donc au parent, dans une région
 *    PERSISTANTE (`onAnnoncer`) — même patron que la région d'annonce de la conversation.
 *  • le champ n'était pas ANNULABLE : ni Échap ni bouton. En vue liste (pas de fiche, donc pas de × ni
 *    d'Échap de fiche), un renommage ouvert par erreur était sans issue.
 *  • aucune borne de LONGUEUR côté app alors que la base en pose une (`length(nom) <= 300`, migration 0023) :
 *    le bouton restait actif et la RPC levait un échec incompréhensible.
 *
 * A11y : le champ est étiqueté, l'échec est relié par `aria-describedby`, le succès est annoncé par le
 * parent, et le focus ne retombe jamais sur <body> (le parent le rend au bouton d'ouverture).
 * AD-7 : muet, l'écriture passe par le callback (route `^/api/`).
 */

import { useEffect, useId, useRef, useState } from "react";
import {
  CHAMP_RENOMMER_LABEL,
  ACTION_VALIDER_RENOMMAGE,
  ACTION_ANNULER_RENOMMAGE,
  ECHEC_RENOMMAGE,
  SUCCES_RENOMMAGE,
} from "./copie-arbre";
import { NOM_LONGUEUR_MAX } from "@/render/nom-branche";
import s from "./arbre.module.css";

/* La validation du nom vit dans UN SEUL module partagé avec le chemin de la naissance (Story 4.5) :
 * la classe était dupliquée ici et là-bas, et seule celle-ci avait reçu le durcissement R1-bis. */
export { nomDonne, nomRecevable } from "@/render/nom-branche";
import { nomRecevable, rognerNom } from "@/render/nom-branche";
export interface ProprietesChampRenommage {
  brancheId: string;
  onRenommer: (brancheId: string, nom: string) => Promise<boolean>;
  /** Fermeture du champ (succès OU annulation). Le parent rend le focus au bouton d'ouverture. */
  onTermine?: () => void;
  /** Annonce a11y déposée dans une région live PERSISTANTE du parent (ce composant, lui, disparaît). */
  onAnnoncer?: (texte: string) => void;
  autoFocus?: boolean;
}

export default function ChampRenommage({
  brancheId,
  onRenommer,
  onTermine,
  onAnnoncer,
  autoFocus,
}: ProprietesChampRenommage) {
  const [texte, setTexte] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [echec, setEchec] = useState(false);
  const champRef = useRef<HTMLInputElement>(null);
  const idChamp = useId();
  const idErreur = `${idChamp}-erreur`;

  useEffect(() => {
    if (autoFocus) requestAnimationFrame(() => champRef.current?.focus());
  }, [autoFocus]);

  async function valider() {
    if (!nomRecevable(texte) || enCours) return;
    setEnCours(true);
    setEchec(false);
    const ok = await onRenommer(brancheId, rognerNom(texte));
    setEnCours(false);
    if (ok) {
      setTexte("");
      onAnnoncer?.(SUCCES_RENOMMAGE); // au PARENT : sa région live survit à notre démontage
      onTermine?.();
    } else {
      setEchec(true);
      // Le focus ne part pas : elle peut corriger et réessayer sans re-naviguer.
      champRef.current?.focus();
    }
  }

  return (
    <div className={s.renommage}>
      <label className={s.renommageLabel} htmlFor={idChamp}>
        {CHAMP_RENOMMER_LABEL}
      </label>
      <input
        id={idChamp}
        ref={champRef}
        className={s.renommageChamp}
        type="text"
        value={texte}
        maxLength={NOM_LONGUEUR_MAX}
        autoComplete="off"
        aria-describedby={echec ? idErreur : undefined}
        aria-invalid={echec || undefined}
        onChange={(e) => setTexte(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            void valider();
            return;
          }
          // Échap referme SANS écrire. `stopPropagation` : sans lui, l'Échap de la fiche fermerait aussi
          // la fiche entière, et l'utilisatrice perdrait la branche qu'elle regardait pour un simple renoncement.
          if (e.key === "Escape") {
            e.stopPropagation();
            onTermine?.();
          }
        }}
      />
      <button
        type="button"
        className={s.actionPrincipale}
        disabled={!nomRecevable(texte) || enCours}
        onClick={() => void valider()}
      >
        {ACTION_VALIDER_RENOMMAGE}
      </button>
      <button type="button" className={s.actionSecondaire} onClick={() => onTermine?.()}>
        {ACTION_ANNULER_RENOMMAGE}
      </button>
      {echec && (
        <p id={idErreur} className={s.echec} role="alert">
          {ECHEC_RENOMMAGE}
        </p>
      )}
    </div>
  );
}
