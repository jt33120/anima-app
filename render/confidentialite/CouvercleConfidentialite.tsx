"use client";

import { useEffect } from "react";
import styles from "./couvercle.module.css";

/**
 * LE PRIVACY-COVER (Story 6.2, AC5 · DESIGN.md §301 et §427).
 *
 * Quand l'application passe en arrière-plan, le système photographie l'écran pour en faire la vignette
 * du sélecteur de tâches. Cette vignette survit à la fermeture de l'app, s'affiche à qui appuie deux
 * fois sur le bouton d'accueil, et n'est protégée par aucune authentification. C'est la troisième
 * surface exposée au monde, après l'icône et l'aperçu de notification — et la seule qui montrerait
 * l'intérieur d'une séance.
 *
 * ── POURQUOI CE N'EST PAS UN `useState` ──────────────────────────────────────────────────────────────
 *
 * ⚠️ Le point technique de tout ce composant. Un `setState` reprogramme un rendu, un rendu attend une
 * peinture, et sur iOS la capture est prise dans l'image qui suit immédiatement le passage en
 * arrière-plan. Le couvercle arriverait après la photo — et le test serait vert, parce qu'en jsdom il
 * n'y a pas de peinture à rater.
 *
 * L'attribut est donc posé **de façon synchrone** sur `<html>`, dans le gestionnaire lui-même. Le
 * couvercle est déjà dans le DOM, déjà stylé, déjà positionné : il ne reste qu'à le rendre visible,
 * ce que le moteur de style fait dans la même image.
 *
 * ── CE QUE CE N'EST PAS ──────────────────────────────────────────────────────────────────────────────
 *
 * Ce n'est pas un verrou : elle revient sans rien retaper. Ça ne protège pas d'une capture d'écran
 * volontaire, ni d'un regard par-dessus l'épaule pendant qu'elle lit. Ça couvre exactement une chose —
 * l'image que le système garde d'elle après qu'elle a rangé son téléphone — et c'est déjà la plus
 * durable des trois.
 */
export function CouvercleConfidentialite() {
  useEffect(() => {
    const racine = document.documentElement;
    const poser = () => racine.setAttribute("data-couvercle", "pose");
    const retirer = () => racine.removeAttribute("data-couvercle");

    const surVisibilite = () => {
      if (document.visibilityState === "hidden") poser();
      else retirer();
    };

    document.addEventListener("visibilitychange", surVisibilite);
    // ⚠️ `pagehide` EN PLUS, et il n'est pas redondant : sur Safari iOS, le retour à l'écran d'accueil
    // par balayage déclenche `pagehide` sans toujours passer par `visibilitychange`. Un seul des deux
    // laisserait un chemin découvert, et c'est le chemin le PLUS courant sur la plateforme où la
    // vignette est la plus visible.
    window.addEventListener("pagehide", poser);
    // Le retour, lui, est fiable des deux côtés — mais on l'écoute quand même explicitement, sans quoi
    // un `pagehide` sans `visibilitychange` correspondant laisserait le couvercle posé au retour.
    window.addEventListener("pageshow", retirer);

    return () => {
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("pagehide", poser);
      window.removeEventListener("pageshow", retirer);
      retirer();
    };
  }, []);

  return (
    // `aria-hidden` : pour une lectrice d'écran, ce couvercle n'existe pas — il ne dit rien qu'elle
    // ait besoin d'entendre, et l'annoncer à chaque passage en arrière-plan serait du bruit.
    <div className={styles.couvercle} aria-hidden="true" data-testid="couvercle-confidentialite">
      <span className={styles.mot}>Anam</span>
    </div>
  );
}
