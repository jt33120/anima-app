"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { conclureTest, departagerExAequo, enregistrerReponses, type EtatTest } from "./actions";
import s from "./enneagramme.module.css";

/**
 * test-court.tsx — LES DIX-HUIT ÉNONCÉS, UN À LA FOIS (Story 5.5, AC1 — D8/D9).
 *
 * ── AUCUN COMPTEUR, ET C'EST UNE EXIGENCE ─────────────────────────────────────────────────────
 *
 * FR-031 : « aucun score, aucune note, aucune jauge, aucune série ». `DESIGN.md:695` bannit
 * nommément barre de progression, anneau de complétion, pourcentage, compteur, badge, score,
 * graphique. `EXPERIENCE.md:291` : « pas d'indicateur d'étape, pas de "étape 2 sur 4" ».
 *
 * Ce n'est pas de la coquetterie : dix-huit questions sur la manière dont on cède, dont on doute et
 * dont on se protège deviennent une PERFORMANCE À TERMINER dès qu'un « 12/18 » s'affiche à côté.
 * Il n'y a donc aucun état de progression dans ce composant, et aucune classe de jauge dans son CSS.
 *
 * ── LE BARÈME N'EST PAS ICI ───────────────────────────────────────────────────────────────────
 *
 * Les énoncés descendent avec leur identifiant STABLE, jamais avec leur type ; la réponse remonte en
 * `(itemId → niveau)`, jamais en index de position. Insérer ou réordonner une question ne décale
 * donc rien. Le score se calcule côté serveur (décision D7).
 *
 * ── LE REMONTAGE, PAS LA REMISE À ZÉRO (décision D9) ──────────────────────────────────────────
 *
 * Ce composant est monté avec `key={tentativeId}` par la page. « Refaire le test » efface la passe
 * et la suivante reçoit un nouvel identifiant : l'arbre React est remonté, et aucune réponse de la
 * passe précédente ne peut survivre à l'écran. C'est la parade du défaut n° 6 de la revue 4.6 — le
 * champ de renommage qui fuyait d'une branche à l'autre — appliquée avant que la faute n'arrive.
 *
 * `localStorage` est BANNI (contamination entre comptes sur navigateur partagé) : la persistance
 * passe par la base, sous RLS.
 *
 * ── LE VERROU D'ENVOI EST SYNCHRONE ───────────────────────────────────────────────────────────
 *
 * `useRef`, posé AVANT tout `await`. Un `useState` ne se met à jour qu'au rendu suivant : deux
 * clics rapides sur le dernier énoncé enverraient deux conclusions, donc deux `terminerTentative`.
 * La seconde rendrait `false` (la tentative a disparu) — sans dégât, mais l'écran l'aurait annoncé
 * comme un échec. C'est la leçon n° 12 de la 4.5.
 */

export interface ItemAffiche {
  readonly id: string;
  readonly texte: string;
}

export default function TestCourt({
  items,
  libelles,
  reponsesInitiales,
}: {
  items: readonly ItemAffiche[];
  /** Les quatre libellés de l'échelle, dans l'ordre 0..3, servis par le serveur (jamais recopiés). */
  libelles: readonly string[];
  /** Ce qui est déjà en base — la reprise (NFR-017). */
  reponsesInitiales: Readonly<Record<string, number>>;
}) {
  const router = useRouter();
  const [reponses, setReponses] = useState<Record<string, number>>({ ...reponsesInitiales });
  const [etat, setEtat] = useState<EtatTest>({ statut: "en_cours" });
  const verrou = useRef(false);
  const [envoi, setEnvoi] = useState(false);

  // L'énoncé en cours : le PREMIER auquel elle n'a pas répondu. À la reprise, elle retombe donc
  // exactement là où elle s'était arrêtée, sans avoir à refaire ce qui est déjà fait.
  const courant = items.find((i) => reponses[i.id] === undefined) ?? null;

  // ── LE FOCUS NE SE PERD JAMAIS, ET C'EST LA CLÉ DES `<li>` QUI LE TIENT ──────────────────────
  //
  // ⚠️ MESURÉ, PAS SUPPOSÉ. J'avais d'abord écrit un `useEffect` qui déplaçait le focus sur la
  // première réponse après chaque énoncé. Le mutant qui le retire est resté VERT — et pour une
  // raison qui change le code plutôt que le test : les quatre `<li>` sont clés sur le LIBELLÉ, qui
  // ne varie pas d'un énoncé à l'autre. React réconcilie donc les mêmes nœuds DOM au lieu de les
  // démonter, et le focus reste naturellement sur le bouton cliqué.
  //
  // L'effet ne gardait donc rien : il DÉPLAÇAIT le focus, de « Tout à fait » vers « Pas du tout »,
  // c'est-à-dire vers une réponse qu'elle n'avait pas choisie. On l'a retiré.
  //
  // ⚠️ CE QUI RESTE LOAD-BEARING : la clé ne doit JAMAIS dépendre de l'énoncé. `key={courant.id}`
  // ou `key={`${courant.id}-${libelle}`}` démonterait les quatre boutons à chaque réponse, le focus
  // retomberait sur <body>, et un test de dix-huit questions deviendrait injouable au clavier comme
  // au lecteur d'écran — le défaut trouvé quatre fois en revue 4.6. Une garde de rendu le vérifie.

  async function repondre(itemId: string, niveau: number) {
    // ⚠️ SYNCHRONE, avant tout `await` : c'est ce qui distingue ce verrou d'un `useState`.
    if (verrou.current) return;
    verrou.current = true;

    const suivantes = { ...reponses, [itemId]: niveau };
    // On AVANCE d'abord. L'écran ne dépend pas du réseau : ses réponses vivent dans l'état local,
    // et la conclusion les renverra toutes de toute façon.
    setReponses(suivantes);
    setEtat({ statut: "en_cours" });

    const reste = items.some((i) => suivantes[i.id] === undefined);
    try {
      if (reste) {
        // Persistance de reprise, en tâche de fond. Un échec ne perd rien à l'écran — il se DIT.
        const { ok } = await enregistrerReponses(suivantes);
        if (!ok) setEtat({ statut: "erreur", message: "Ta réponse n’est pas encore enregistrée." });
      } else {
        setEnvoi(true);
        const r = await conclureTest(suivantes);
        if (r.statut === "retenu") {
          // La page se recharge sur le résultat : l'état serveur fait foi, jamais une copie locale.
          router.refresh();
          return;
        }
        setEtat(r);
      }
    } finally {
      verrou.current = false;
      setEnvoi(false);
    }
  }

  async function choisir(type: number) {
    if (verrou.current) return;
    verrou.current = true;
    setEnvoi(true);
    try {
      const r = await departagerExAequo(type);
      if (r.statut === "retenu") {
        router.refresh();
        return;
      }
      setEtat(r);
    } finally {
      verrou.current = false;
      setEnvoi(false);
    }
  }

  // ── L'EX ÆQUO : LE PRODUIT REFUSE DE TRANCHER, ET LUI REND LA MAIN ───────────────────────────
  // Départager par « le plus petit numéro » aurait biaisé silencieusement vers le type 1 — un type
  // faux, parfaitement déterministe, donc invisible à tout test de reproductibilité. Elle sait.
  if (etat.statut === "indecis") {
    return (
      <section className={`${s.bloc} fondu-texte`} aria-label="Des lectures à égalité">
        {/* ⚠️ « DEUX » ÉTAIT ÉCRIT EN DUR, ET L'ÉGALITÉ PEUT PORTER SUR TROIS (QA tour 1, T20).
            Mesuré le 2026-08-15 : « Deux façons de te lire arrivent à égalité » suivi de TROIS
            boutons — Le type 5, Le type 7, Le type 9. Sur un écran qui refuse de trancher à sa
            place, se tromper en comptant ses propres options est le pire endroit possible : c'est
            précisément celui où elle doit pouvoir se fier à ce qu'on lui montre.

            Le nombre DÉRIVE désormais de la liste rendue — il ne peut plus diverger d'elle. */}
        <p className="t-corps">
          {etat.exaequo.length === 2 ? "Deux" : "Plusieurs"} façons de te lire arrivent à égalité. Je
          ne choisis pas à ta place — laquelle te parle le plus&nbsp;?
        </p>
        <ul className={s.reponses}>
          {etat.exaequo.map((t) => (
            <li key={t}>
              <button type="button" className={s.reponse} disabled={envoi} onClick={() => choisir(t)}>
                <span className="t-corps">Le type {t}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (!courant) {
    // Toutes les réponses sont là mais rien n'a conclu : un envoi en vol, ou un échec déjà annoncé.
    return (
      <section className={s.bloc}>
        <p className="t-corps">{envoi ? "…" : "Tes réponses sont enregistrées."}</p>
        {etat.statut === "erreur" ? (
          <p className={s.erreur} role="alert">
            {etat.message}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className={s.bloc} aria-label="Le test">
      {/* La `key` fait rejouer le fondu à chaque énoncé — 320 ms, `DESIGN.md:308` : rien ne glisse. */}
      <p key={courant.id} className={`${s.enonce} t-corps fondu-texte`}>
        {courant.texte}
      </p>
      <ul className={s.reponses}>
        {libelles.map((libelle, niveau) => (
          <li key={libelle}>
            <button
              type="button"
              className={s.reponse}
              disabled={envoi}
              onClick={() => repondre(courant.id, niveau)}
            >
              {/* Les quatre degrés ont exactement la même forme : une échelle dont un degré se
                  remarque plus que les autres suggère une bonne réponse. */}
              <span className="t-corps">{libelle}</span>
            </button>
          </li>
        ))}
      </ul>
      {etat.statut === "erreur" ? (
        <p className={s.erreur} role="alert">
          {etat.message}
        </p>
      ) : null}
    </section>
  );
}
