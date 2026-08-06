"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  PLAN_TITRE,
  PLAN_VIDE,
  PLAN_EN_COURS,
  PLAN_INDISPONIBLE,
  ACTION_AJOUTER_ETAPE,
  ACTION_ENREGISTRER_ETAPE,
  ACTION_ANNULER_ETAPE,
  ACTION_RETIRER_ETAPE,
  ACTION_MODIFIER_ETAPE,
  CHAMP_SI_LABEL,
  CHAMP_ALORS_LABEL,
  CHAMP_ECHEANCE_LABEL,
  SUCCES_ETAPE,
  SUCCES_MODIF_ETAPE,
  SUCCES_RETRAIT_ETAPE,
  ECHEC_ETAPE,
  ECHEC_RETRAIT_ETAPE,
  REFUS_ETAPE,
  ECHEANCE_TROP_TOT,
  ECHEANCE_LE,
} from "./copie-arbre";
import { etapeRecevable, echeanceRecevable, rognerMoitie, demainParis, INTENTION_LONGUEUR_MAX } from "@/render/intention";
import s from "./arbre.module.css";

/**
 * PlanEtapes — le PLAN D'ÉTAPES d'une branche (Story 4.10, FR-032/FR-081, AC1/AC2/AC6). Composant CLIENT,
 * MUET (AD-7) : il ne décide RIEN. Les gardes (premium, consentement art. 9, AD-17, appartenance) vivent
 * au point d'écriture (policies WITH CHECK, migration 0036) ; ce composant ne fait que transmettre.
 *
 * ── LA FORME « SI X, ALORS Y » N'EST PAS UNE CONSIGNE ICI ────────────────────────────────────────────
 *
 * Elle est portée par DEUX CHAMPS, tous deux requis — et par deux colonnes non vides en base. Il n'existe
 * aucune façon d'écrire une étape qui ne soit pas de cette forme. Décision PO D1 : c'est ELLE qui écrit,
 * pas Anam. Une intention d'implémentation est une prescription comportementale ; la faire générer par un
 * modèle tomberait pile dans ce que le PRD interdit — d'où : aucun exemple, aucun placeholder rédigé,
 * aucune suggestion. Les étiquettes ne portent que la conjonction.
 *
 * ── CE QUE LA REVUE 4.10 A CORRIGÉ ICI ──────────────────────────────────────────────────────────────
 *
 *  • AC2 « modifiées » n'existait PAS. La RPC, le dépôt, la route et leurs tests étaient écrits ; le
 *    geste n'avait jamais été câblé. Corriger une formulation obligeait à retirer l'étape et à la
 *    réécrire — en perdant son rang et son échéance.
 *  • REFUS et PANNE étaient confondus. « Tu peux réessayer » s'affichait aussi pour une garde qui
 *    tiendra des heures — l'anti-patron que la 4.7 avait corrigé pour le geste de rayonnement
 *    (`REFUS_RAYONNEMENT`), réutilisé partout SAUF ici.
 *  • Le retrait n'avait ni verrou ni retour de focus, et annonçait « je n'ai pas pu ENREGISTRER » après
 *    un retrait réussi (double-clic → 409 sur une ligne déjà partie).
 *  • Les réponses concurrentes pouvaient s'écraser dans le désordre : une étape retirée réapparaissait.
 *  • L'échéance n'était validée que par l'attribut `min`, figé au rendu — un formulaire ouvert à minuit
 *    proposait un refus définitif présenté comme réessayable.
 *
 * ── CE QU'ON N'AFFICHE PAS QUAND ON NE PEUT PAS ÉCRIRE ───────────────────────────────────────────────
 *
 * `ouvert=false` (abonnement éteint, ou fenêtre de détresse) → le formulaire n'apparaît pas du tout.
 * C'est la leçon exacte de la revue 4.7 : offrir le champ, la laisser écrire deux phrases sur sa vie
 * intérieure, puis refuser à l'enregistrement, c'est mentir par omission. Et on n'explique PAS lequel
 * des deux motifs a fermé le champ — lui annoncer que le système l'a classée n'est autorisé nulle part.
 *
 * Le plan DÉJÀ ÉCRIT reste lu et retirable dans tous les cas : ses données ne sont pas séquestrées, et
 * alléger n'est pas écrire (policy `intention_retrait`, 0036).
 *
 * ── PANNE ≠ PLAN VIDE ≠ CHARGEMENT ──────────────────────────────────────────────────────────────────
 *
 * Trois états distincts, trois textes. Une lecture en échec n'affiche pas « Rien encore. » — ce serait
 * dire à quelqu'un qui a un plan qu'elle n'en a pas (revue 4.6, HAUTE) — et le chargement ne se déguise
 * ni en l'un ni en l'autre.
 */

export interface Etape {
  readonly id: string;
  readonly declencheur: string;
  readonly action: string;
  readonly echeance: string | null;
}

type Chargement = "en_cours" | "pret" | "indisponible";
/** Ce que le formulaire est en train de faire : rien, un ajout, ou la révision d'une étape précise. */
type Saisie = { readonly mode: "ferme" } | { readonly mode: "ajout" } | { readonly mode: "revision"; readonly id: string };

function dateLisible(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  // `timeZone` explicite : sans lui, au-delà de UTC+12 l'échéance s'affiche au lendemain. `periodeLisible`
  // (domaine synthèse) a payé exactement ce défaut deux fois avant de l'imposer.
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export default function PlanEtapes({
  brancheId,
  ouvert,
  onAnnoncer,
}: {
  brancheId: string;
  /** L'écriture est-elle possible ? Décidé SERVEUR (`planOuvert`, lib/scene) — jamais déduit ici. */
  ouvert?: boolean;
  /** Dépose une annonce a11y dans la région live PERSISTANTE de la région arbre. */
  onAnnoncer?: (texte: string) => void;
}) {
  const [etapes, setEtapes] = useState<Etape[]>([]);
  const [chargement, setChargement] = useState<Chargement>("en_cours");
  const [saisie, setSaisie] = useState<Saisie>({ mode: "ferme" });
  const [si, setSi] = useState("");
  const [alors, setAlors] = useState("");
  const [echeance, setEcheance] = useState("");
  const [enVol, setEnVol] = useState(false);
  /**
   * ⚠️ LE VERROU EST UNE `ref`, PAS L'ÉTAT — et le test l'a prouvé sur mon premier correctif.
   *
   * `setEnVol(true)` ne prend effet qu'au rendu SUIVANT : deux clics dans le même tick lisent tous les
   * deux `enVol === false` et partent tous les deux. L'état sert à DÉSACTIVER visuellement le bouton ;
   * seule une `ref`, écrite de façon synchrone, empêche réellement le second envoi.
   */
  const verrou = useRef(false);
  const [echec, setEchec] = useState<string | null>(null);
  const champSiRef = useRef<HTMLInputElement>(null);
  const boutonAjouterRef = useRef<HTMLButtonElement>(null);
  /** Le bouton qui a ouvert la révision — on lui rend le focus à la fermeture (WCAG 2.4.3). */
  const boutonsModifier = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  /** Ids DOM uniques : `useId` plutôt que des chaînes en dur (patron `ChampRenommage`), pour que deux
   *  plans montés en même temps ne cassent pas `htmlFor`/`aria-describedby`. */
  const idBase = useId();
  const idSi = `${idBase}-si`;
  const idAlors = `${idBase}-alors`;
  const idEcheance = `${idBase}-echeance`;
  const idEchec = `${idBase}-echec`;

  /**
   * Le numéro de la dernière lecture DEMANDÉE. Une réponse plus ancienne qui arrive après une plus
   * récente est jetée : sans ça, un ajout suivi d'un retrait pouvait faire RÉAPPARAÎTRE l'étape
   * supprimée, si les deux `GET` revenaient dans le désordre (revue 4.10).
   */
  const lecture = useRef(0);
  /** Le composant est-il encore monté ? Évite un `setState` sur une instance détachée. */
  const monte = useRef(true);
  useEffect(() => {
    monte.current = true;
    return () => {
      monte.current = false;
    };
  }, []);

  const recharger = useCallback(async () => {
    const mien = ++lecture.current;
    try {
      const r = await fetch(`/api/anam/plan?brancheId=${encodeURIComponent(brancheId)}`);
      if (mien !== lecture.current || !monte.current) return; // une lecture plus récente a pris la main
      if (!r.ok) return setChargement("indisponible");
      const json = (await r.json()) as { plan?: Etape[] };
      if (mien !== lecture.current || !monte.current) return;
      setEtapes(json.plan ?? []);
      setChargement("pret");
    } catch {
      if (mien === lecture.current && monte.current) setChargement("indisponible");
    }
  }, [brancheId]);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  // Le champ « Si… » prend le focus quand le formulaire paraît (sinon le focus reste sur un bouton qui
  // vient de disparaître, et un lecteur d'écran n'annonce rien).
  useEffect(() => {
    if (saisie.mode !== "ferme") champSiRef.current?.focus();
  }, [saisie.mode]);

  /**
   * ⚠️ SI L'ÉCRITURE SE FERME PENDANT LA SAISIE, on referme proprement plutôt que de laisser le
   * formulaire s'évaporer sous le curseur. Sans ça, le focus retombait sur `<body>` et un brouillon
   * restait en mémoire, prêt à ressurgir sans lien avec le moment présent.
   */
  useEffect(() => {
    if (!ouvert && saisie.mode !== "ferme") {
      setSaisie({ mode: "ferme" });
      setSi("");
      setAlors("");
      setEcheance("");
      setEchec(null);
    }
  }, [ouvert, saisie.mode]);

  const fermerSaisie = () => {
    const precedent = saisie;
    setSaisie({ mode: "ferme" });
    setSi("");
    setAlors("");
    setEcheance("");
    setEchec(null);
    // Le focus revient au bouton qui a ouvert le formulaire, jamais sur <body> (WCAG 2.4.3).
    requestAnimationFrame(() => {
      const cible =
        precedent.mode === "revision" ? boutonsModifier.current.get(precedent.id) : boutonAjouterRef.current;
      cible?.focus();
    });
  };

  const ouvrirRevision = (e: Etape) => {
    setSi(e.declencheur);
    setAlors(e.action);
    // ⚠️ Une échéance DÉJÀ PASSÉE est vidée à l'ouverture : la renvoyer telle quelle ferait refuser la
    // révision (`echeanceRecevable`), rendant l'étape non modifiable sans qu'on comprenne pourquoi.
    setEcheance(e.echeance && echeanceRecevable(e.echeance) ? e.echeance : "");
    setEchec(null);
    setSaisie({ mode: "revision", id: e.id });
  };

  /** Le formulaire est-il soumissible ? La forme ET l'échéance — la seconde manquait (revue 4.10). */
  const soumissible = etapeRecevable(si, alors) && echeanceRecevable(echeance || null) && !enVol;

  /** Traduit une réponse HTTP en message HONNÊTE : un refus n'est pas une panne (patron 4.7). */
  const messageDe = (statut: number, retrait: boolean) =>
    statut === 403 || statut === 409 ? REFUS_ETAPE : retrait ? ECHEC_RETRAIT_ETAPE : ECHEC_ETAPE;

  const enregistrer = async () => {
    if (!soumissible || saisie.mode === "ferme" || verrou.current) return;
    verrou.current = true;
    setEnVol(true);
    setEchec(null);
    const revision = saisie.mode === "revision";
    try {
      // On envoie les moitiés ROGNÉES comme le fera la base : sinon un même texte collé serait stocké tel
      // quel puis rogné à la première révision — le texte changerait tout seul (défaut corrigé en 0024).
      const r = await fetch("/api/anam/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: revision ? "reviser" : "ajouter",
          ...(revision ? { intentionId: saisie.id } : { brancheId }),
          declencheur: rognerMoitie(si),
          alors: rognerMoitie(alors),
          echeance: echeance || null,
        }),
      });
      if (!r.ok) {
        setEchec(messageDe(r.status, false));
        onAnnoncer?.(messageDe(r.status, false));
        return;
      }
      await recharger();
      onAnnoncer?.(revision ? SUCCES_MODIF_ETAPE : SUCCES_ETAPE);
      fermerSaisie();
    } catch {
      setEchec(ECHEC_ETAPE);
      onAnnoncer?.(ECHEC_ETAPE);
    } finally {
      verrou.current = false;
      if (monte.current) setEnVol(false);
    }
  };

  const retirer = async (id: string) => {
    // ⚠️ VERROU D'ENVOI, comme pour l'enregistrement. Sans lui, un double-clic envoyait deux POST : le
    // second ne trouvait plus la ligne, recevait 409, et le composant annonçait « je n'ai pas pu
    // enregistrer » — un échec d'écriture proclamé après une suppression réussie, pendant que la liste
    // affichait déjà le contraire.
    if (verrou.current) return;
    verrou.current = true;
    setEnVol(true);
    try {
      const r = await fetch("/api/anam/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "retirer", intentionId: id }),
      });
      if (!r.ok) return onAnnoncer?.(messageDe(r.status, true));
      // Suppression FRANCHE : la ligne n'existe plus, aucun tombstone (AD-18 ne s'applique pas au plan,
      // qui est « une suite vivante, pas figée »). On recharge plutôt que de retirer localement, pour ne
      // jamais afficher un plan que la base ne confirmerait pas.
      await recharger();
      onAnnoncer?.(SUCCES_RETRAIT_ETAPE);
    } catch {
      onAnnoncer?.(ECHEC_RETRAIT_ETAPE);
    } finally {
      verrou.current = false;
      if (monte.current) setEnVol(false);
      // Le bouton focalisé vient de disparaître du DOM au rechargement : on ramène le focus DANS la
      // section, jamais sur <body> — toutes les autres actions du fichier le font déjà.
      requestAnimationFrame(() => boutonAjouterRef.current?.focus());
    }
  };

  const enSaisie = saisie.mode !== "ferme";

  return (
    <section className={s.plan} aria-labelledby={`${idBase}-titre`}>
      <h3 className={s.planTitre} id={`${idBase}-titre`}>
        {PLAN_TITRE}
      </h3>

      {chargement === "en_cours" ? (
        <p className={s.planVide}>{PLAN_EN_COURS}</p>
      ) : chargement === "indisponible" ? (
        <p className={s.planVide}>{PLAN_INDISPONIBLE}</p>
      ) : etapes.length === 0 ? (
        <p className={s.planVide}>{PLAN_VIDE}</p>
      ) : (
        <ul className={s.planListe}>
          {etapes.map((e) => (
            <li key={e.id} className={s.planEtape}>
              {/* La forme se LIT aussi : « Si … » puis « … alors … », dans SA police à elle (t-corps),
                  jamais celle d'Anam — ces mots sont les siens. */}
              <p className="t-corps">
                <span className={s.planConjonction}>{CHAMP_SI_LABEL} </span>
                {e.declencheur}
              </p>
              <p className="t-corps">
                <span className={s.planConjonction}>{CHAMP_ALORS_LABEL} </span>
                {e.action}
              </p>
              {e.echeance && <p className="t-meta">{ECHEANCE_LE(dateLisible(e.echeance))}</p>}
              <div className={s.ficheActions}>
                {/* AC2 « modifiées » — le geste qui manquait. Fermé quand l'écriture l'est, comme l'ajout. */}
                {ouvert && !enSaisie && (
                  <button
                    type="button"
                    className={s.actionSecondaire}
                    ref={(el) => void boutonsModifier.current.set(e.id, el)}
                    onClick={() => ouvrirRevision(e)}
                  >
                    {ACTION_MODIFIER_ETAPE}
                  </button>
                )}
                <button
                  type="button"
                  className={s.actionSecondaire}
                  disabled={enVol}
                  onClick={() => void retirer(e.id)}
                >
                  {ACTION_RETIRER_ETAPE}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {ouvert && !enSaisie && (
        <button
          type="button"
          className={s.actionSecondaire}
          ref={boutonAjouterRef}
          onClick={() => setSaisie({ mode: "ajout" })}
        >
          {ACTION_AJOUTER_ETAPE}
        </button>
      )}

      {ouvert && enSaisie && (
        <form
          className={s.planSaisie}
          onSubmit={(e) => {
            e.preventDefault();
            void enregistrer();
          }}
        >
          {/* Étiquettes VISIBLES, jamais un placeholder en guise d'étiquette — et surtout aucun exemple :
              ce que l'étape contient ne vient que d'elle. */}
          <label htmlFor={idSi} className="t-corps">
            {CHAMP_SI_LABEL}
          </label>
          <input
            id={idSi}
            ref={champSiRef}
            type="text"
            value={si}
            onChange={(e) => setSi(e.target.value)}
            className={s.planChamp}
            autoComplete="off"
            maxLength={INTENTION_LONGUEUR_MAX}
          />

          <label htmlFor={idAlors} className="t-corps">
            {CHAMP_ALORS_LABEL}
          </label>
          <input
            id={idAlors}
            type="text"
            value={alors}
            onChange={(e) => setAlors(e.target.value)}
            className={s.planChamp}
            autoComplete="off"
            maxLength={INTENTION_LONGUEUR_MAX}
          />

          <label htmlFor={idEcheance} className="t-corps">
            {CHAMP_ECHEANCE_LABEL}
          </label>
          {/* `min` = DEMAIN à Paris. Le rappel du jour part au tick de l'ordonnanceur (06:00 UTC) : une
              échéance posée aujourd'hui après cette heure ne se déclencherait JAMAIS — et rien n'est
              rattrapé. C'est littéralement l'argument qui fait refuser hier, appliqué au cas fréquent.
              Le `min` seul ne suffit pas (il est figé au rendu, et tous les navigateurs ne le tiennent
              pas) : `soumissible` revalide à chaque frappe. */}
          <input
            id={idEcheance}
            type="date"
            value={echeance}
            min={demainParis()}
            onChange={(e) => setEcheance(e.target.value)}
            className={s.planChamp}
            aria-describedby={echeance && !echeanceRecevable(echeance) ? `${idBase}-echeance-aide` : undefined}
          />
          {echeance && !echeanceRecevable(echeance) && (
            <p id={`${idBase}-echeance-aide`} className="t-meta">
              {ECHEANCE_TROP_TOT}
            </p>
          )}

          {echec && (
            <p id={idEchec} className="t-meta" role="alert">
              {echec}
            </p>
          )}

          <div className={s.ficheActions}>
            <button
              type="submit"
              className={s.actionSecondaire}
              disabled={!soumissible}
              aria-describedby={echec ? idEchec : undefined}
            >
              {ACTION_ENREGISTRER_ETAPE}
            </button>
            <button type="button" className={s.actionSecondaire} onClick={fermerSaisie} disabled={enVol}>
              {ACTION_ANNULER_ETAPE}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
