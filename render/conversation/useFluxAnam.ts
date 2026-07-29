"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyserTrame, detacherMotsComplets, extraireLignes, type BeatRecu } from "./flux-ndjson-client";
import type { RessourceVue } from "./types";

/**
 * useFluxAnam — l'état de STREAMING côté client (Story 2.2, B4). Consomme le flux NDJSON de
 * `app/api/anam/message` via `response.body.getReader()` + `TextDecoder({stream})`, et révèle le
 * texte d'Anam PAR GROUPES DE MOTS (la logique décidable est prouvée dans `flux-ndjson-client`).
 *
 * AD-7/AD-2 : ce hook ne connaît QUE `fetch` vers `app/api` — aucun `lib/ai`, aucun secret, aucun
 * tier (résolu serveur). Il n'ACCUMULE aucune donnée art. 9 ailleurs que dans l'état de vue éphémère.
 *
 * Contrat du flux (Phase A) : `delta* (fin | erreur)`. `fin`/`erreur` sont TERMINALES (on arrête de
 * lire dès l'une d'elles). `fin` = succès (annonce a11y du message complet). `erreur` OU flux clos
 * sans `fin` (coupure) = échec : le texte partiel est CONSERVÉ + « Réessayer », jamais retiré du fil.
 * `AbortError` (départ volontaire) ne vide pas le partiel et ne déclenche pas d'échec bruyant.
 *
 * Robustesse (revue 2.2) : les rappels terminaux (onFin/onEchec) sont dispatchés HORS du try/catch
 * du flux (un rappel consommateur qui jette ne rebascule pas un succès en échec) ; l'état
 * (prepare/enCours) n'est écrasé QUE si cet envoi est toujours le courant (un envoi supersédé ne
 * clobbe pas l'état de son successeur) ; le reader est libéré sur tous les chemins.
 */

export interface MessageEnvoi {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface RappelsFlux {
  /** Incrément de texte révélé (un ou plusieurs mots complets). Jamais caractère par caractère. */
  onMotsReveles: (mots: string) => void;
  /** Fin propre : le message complet, à annoncer UNE fois au lecteur d'écran (aria-atomic). */
  onFin: (texteComplet: string) => void;
  /** Échec (erreur fournisseur ou coupure) : garder le partiel + proposer « Réessayer ». */
  onEchec: (textePartiel: string) => void;
  /** Bloc ressources de détresse (Story 2.6) : à insérer AVANT/APRÈS le tour d'Anam (le serveur décide). */
  onRessources?: (position: "avant" | "apres", ressources: readonly RessourceVue[], verifieLe: string) => void;
  /** Beat d'apparition d'Anam (Story 2.7) : Anam paraît en Présence. NON terminal, ne vole jamais le focus. */
  onBeat?: (beat: BeatRecu) => void;
}

export function useFluxAnam() {
  /** « Anam prépare » : vrai entre l'envoi et le 1er MOT révélé → épaissit le signe (AC2). */
  const [prepare, setPrepare] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const interrompre = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  // Abort au démontage (départ de page) — SANS vider le texte déjà affiché (le partiel reste).
  useEffect(() => () => abortRef.current?.abort(), []);

  const envoyer = useCallback(
    async (messages: MessageEnvoi[], rappels: RappelsFlux) => {
      interrompre();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const estCourant = () => abortRef.current === ctrl; // faux dès qu'un envoi ultérieur supersède
      setEnCours(true);
      setPrepare(true);

      let tampon = ""; // NDJSON partiel (chunk coupé)
      let motsBuffer = ""; // texte reçu, mot en cours pas encore révélé
      let revele = ""; // texte déjà révélé (= message complet à la fin)
      let finPropre = false;
      let premierMot = true;
      let lecteur: ReadableStreamDefaultReader<Uint8Array> | null = null;

      const reveler = (flush: boolean) => {
        const avant = revele.length;
        if (flush) {
          if (motsBuffer) {
            revele += motsBuffer;
            rappels.onMotsReveles(motsBuffer);
            motsBuffer = "";
          }
        } else {
          const { pret, reste } = detacherMotsComplets(motsBuffer);
          motsBuffer = reste;
          if (pret) {
            revele += pret;
            rappels.onMotsReveles(pret);
          }
        }
        // « Anam prépare » cesse au 1er MOT réellement RÉVÉLÉ (AC2), pas au 1er fragment reçu.
        if (premierMot && revele.length > avant && estCourant()) {
          premierMot = false;
          setPrepare(false);
        }
      };

      let issue: "fin" | "echec" | "avorte" = "echec";
      try {
        const reponse = await fetch("/api/anam/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
          signal: ctrl.signal,
        });
        if (!reponse.ok || !reponse.body) throw new Error("reponse_non_ok");

        lecteur = reponse.body.getReader();
        const decodeur = new TextDecoder();
        boucle: for (;;) {
          const { value, done } = await lecteur.read();
          if (done) break;
          tampon += decodeur.decode(value, { stream: true });
          const { lignes, reste } = extraireLignes(tampon);
          tampon = reste;
          for (const ligne of lignes) {
            const trame = analyserTrame(ligne);
            if (!trame) continue;
            if (trame.t === "delta") {
              motsBuffer += trame.c;
              reveler(false);
            } else if (trame.t === "ressources") {
              // Bloc de détresse (2.6), NON terminal : on l'insère et on CONTINUE de lire les deltas.
              // Ne vole jamais le focus (le composeur reste au focus, AC2) — l'insertion est passive.
              rappels.onRessources?.(trame.position, trame.ressources, trame.verifieLe);
            } else if (trame.t === "beat") {
              // Beat d'apparition (2.7), NON terminal : Anam paraît en Présence, on CONTINUE de lire.
              // Passif : ne déplace jamais le focus (le composeur reste actif, acquis AC2 de 2.6).
              rappels.onBeat?.(trame.beat);
            } else {
              // `fin` OU `erreur` : trame TERMINALE → on cesse de lire (aucune trame ne suit).
              if (trame.t === "fin") finPropre = true;
              break boucle;
            }
          }
        }
        reveler(true); // vider le dernier mot (pas de blanc terminal)
        issue = finPropre ? "fin" : "echec"; // flux clos sans `fin` (coupure) → échec
      } catch (e) {
        reveler(true); // ne JAMAIS vider le partiel déjà reçu
        issue = (e as { name?: string }).name === "AbortError" ? "avorte" : "echec";
      } finally {
        try {
          lecteur?.releaseLock();
        } catch {
          /* déjà libéré */
        }
        // N'écrase l'état QUE si cet envoi est toujours le courant (un envoi supersédé n'y touche pas).
        if (estCourant()) {
          setPrepare(false);
          setEnCours(false);
          abortRef.current = null;
        }
      }

      // Dispatch terminal UNE fois, HORS du try/catch : un rappel consommateur qui jette ne peut plus
      // faire rebasculer un succès en échec. Un envoi avorté (départ) ne dispatche rien (partiel gardé).
      if (issue === "avorte") return;
      if (issue === "fin") rappels.onFin(revele);
      else rappels.onEchec(revele);
    },
    [interrompre],
  );

  return { prepare, enCours, envoyer, interrompre };
}
