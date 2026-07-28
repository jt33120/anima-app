"use client";

import s from "./aide.module.css";

/**
 * SortieRapide — le contrôle « Quitter » en tête de /aide (Story 2.6, FR-074). Pratique STANDARD des
 * pages de ressources sur les violences : navigue vers un site NEUTRE et REMPLACE l'entrée d'historique
 * (le bouton « précédent » ne ramène pas ici). Discret, jamais alarmant.
 *
 * Feuille `"use client"` : n'introduit AUCUNE session/IA/traceur — l'étanchéité de /aide (statique,
 * publique, sans dépendance IA — 2.5) est préservée : ce composant ne fait que naviguer.
 *
 * ⚠️ PROVISOIRE — porte pré-lancement (juriste + professionnel qualifié) : l'URL neutre et le libellé
 * sont l'intention produit, à valider avant mise en ligne.
 */

/** Site neutre de repli — PROVISOIRE (à valider). Météo : anodin, crédible, sans trace du contexte. */
const URL_NEUTRE = "https://www.meteofrance.com";

export default function SortieRapide() {
  const quitter = () => {
    // replace() : navigue ET écrase l'entrée d'historique courante → le retour arrière ne revient
    // JAMAIS sur /aide (protège en cas de présence d'un tiers dangereux).
    window.location.replace(URL_NEUTRE);
  };
  return (
    <button type="button" className={s.sortieRapide} onClick={quitter} aria-label="Quitter cette page">
      <span className="t-bouton">Quitter</span>
    </button>
  );
}
