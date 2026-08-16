"use client";

import { useEffect, useRef, useState } from "react";
import s from "./memoire.module.css";

/**
 * L'ÎLOT CLIENT DE « CE QU'ANAM RETIENT » (Story 6.5, T5 ; AC1/AC2/AC3/AC5).
 *
 * ── AUCUN TEXTE N'EST ÉCRIT ICI ────────────────────────────────────────────────────────────────
 *
 * ⚠️ Et aucun import de `lib/domain` : `render/` est un ADAPTATEUR MUET (AD-7), gardé par
 * `tests/arc-architecture.test.ts`. La copie vit dans `lib/domain/copie-memoire.ts`, où les
 * détecteurs la passent au crible, et la page la lui passe — même geste qu'en `/reglages`.
 *
 * ── L'ANNULATION EST UNE RE-DÉPOSITION, PAS UN REMBOBINAGE (D3) ────────────────────────────────
 *
 * La suppression part IMMÉDIATEMENT (D4) ; ce composant garde la phrase en mémoire pendant dix
 * secondes et la repose comme une CORRECTION si elle annule. Il ne peut pas en être autrement : le
 * tombstone vide le contenu — c'est sa raison d'être —, donc rien en base ne permettrait de le
 * restaurer, et 4.2 a fermé exprès le chemin de ré-activation.
 *
 * Conséquence assumée : après un aller-retour, le fait est `corrigé` — possédé par elle, donc hors
 * d'atteinte de toute ré-extraction. C'est la bonne direction.
 */

export interface CopieMemoire {
  readonly etatVide: string;
  readonly corriger: string;
  readonly supprimer: string;
  readonly enregistrer: string;
  readonly renoncer: string;
  readonly annuler: string;
  readonly voirSource: string;
  readonly sourceAbsente: string;
  readonly mentionCorrige: string;
  readonly supprimeAnnonce: string;
  readonly correctionRefusee: string;
}

/**
 * Un fait, tel que la page le descend.
 *
 * ⚠️ AUCUN CHAMP NUMÉRIQUE, ET AUCUN SCORE (AC1). Il n'en existe pas en base non plus : le type le
 * rend impossible plutôt que déconseillé — même patron que l'union `Ouverture` de la 4.10. « Anam est
 * sûre à 82 % que tu n'aimes pas ton travail » est une phrase qu'aucune personne ne devrait avoir à
 * lire sur elle-même, et la seule façon de garantir qu'elle n'apparaîtra jamais est de ne jamais
 * transmettre le nombre.
 */
export interface FaitVue {
  readonly cle: string;
  readonly contenu: string;
  /** D6 — une correction est une donnée, donc elle se voit. Un booléen, jamais un compte. */
  readonly corrige: boolean;
  readonly jour: string;
  readonly source: { readonly texte: string; readonly jour: string } | null;
}

type Etat = { statut: "ok" } | { statut: "erreur"; message: string };

export interface ProprietesMemoire {
  readonly copie: CopieMemoire;
  readonly faits: readonly FaitVue[];
  readonly correctionPossible: boolean;
  readonly corriger: (cle: string, brut: string, actuel: string) => Promise<Etat>;
  readonly supprimer: (cle: string) => Promise<Etat>;
  readonly annuler: (cle: string, contenu: string) => Promise<Etat>;
}

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/**
 * `YYYY-MM-DD` → « 4 août 2026 ».
 *
 * ⚠️ AUCUN `new Date(iso)` ICI. Une date civile n'est pas un instant : la convertir puis la
 * reformater est le geste exact qui fait basculer un jour selon le fuseau du navigateur — défaut
 * déjà payé deux fois dans ce dépôt. On découpe la chaîne, et rien d'autre.
 */
function jourLisible(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const nom = MOIS[Number(m[2]) - 1];
  const j = Number(m[3]);
  if (!nom || j < 1 || j > 31) return null;
  return `${j} ${nom} ${m[1]}`;
}

export default function Memoire(p: ProprietesMemoire) {
  // La liste vient du serveur ; on la recopie pour que suppression et annulation soient immédiates à
  // l'écran. `revalidatePath` remet ensuite les deux en phase.
  const [faits, setFaits] = useState<readonly FaitVue[]>(p.faits);
  useEffect(() => setFaits(p.faits), [p.faits]);

  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState("");
  const [refus, setRefus] = useState<Record<string, string>>({});
  /** Les suppressions annulables : clé → la phrase gardée pour la re-déposer. */
  const [annulables, setAnnulables] = useState<Record<string, string>>({});

  // ⚠️ Les minuteries sont RANGÉES et nettoyées au démontage. Sans ça, une fermeture d'onglet pendant
  // la fenêtre laisse un `setTimeout` qui écrit dans un composant démonté — et React le signale à
  // chaque fois, ce qui finit par masquer les vraies erreurs.
  const minuteries = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    const courantes = minuteries.current;
    return () => {
      for (const t of Object.values(courantes)) clearTimeout(t);
    };
  }, []);

  function poserRefus(cle: string, message: string) {
    setRefus((r) => ({ ...r, [cle]: message }));
  }

  async function enregistrer(f: FaitVue) {
    const issue = await p.corriger(f.cle, brouillon, f.contenu);
    if (issue.statut === "erreur") {
      poserRefus(f.cle, issue.message);
      return;
    }
    setRefus((r) => ({ ...r, [f.cle]: "" }));
    setEnEdition(null);
    setFaits((l) => l.map((x) => (x.cle === f.cle ? { ...x, contenu: brouillon.trim(), corrige: true } : x)));
  }

  async function supprimer(f: FaitVue) {
    const issue = await p.supprimer(f.cle);
    if (issue.statut === "erreur") {
      poserRefus(f.cle, issue.message);
      return;
    }
    // La ligne quitte l'écran tout de suite — elle a réellement quitté la base tout de suite (D4).
    setFaits((l) => l.filter((x) => x.cle !== f.cle));
    setAnnulables((a) => ({ ...a, [f.cle]: f.contenu }));
    minuteries.current[f.cle] = setTimeout(() => {
      setAnnulables((a) => {
        const reste = { ...a };
        delete reste[f.cle];
        return reste;
      });
      delete minuteries.current[f.cle];
    }, FENETRE_ANNULATION_MS_CLIENT);
  }

  async function annuler(cle: string) {
    const contenu = annulables[cle];
    if (!contenu) return;
    const issue = await p.annuler(cle, contenu);
    if (issue.statut === "erreur") {
      poserRefus(cle, issue.message);
      return;
    }
    clearTimeout(minuteries.current[cle]);
    delete minuteries.current[cle];
    setAnnulables((a) => {
      const reste = { ...a };
      delete reste[cle];
      return reste;
    });
  }

  const rien = faits.length === 0 && Object.keys(annulables).length === 0;

  return (
    <>
      {/* AC5 — l'état vide. Il dit qu'il n'y a rien, et surtout PAS que c'est un problème : quelqu'un
          qui vient d'arriver n'a rien à corriger, et c'est parfaitement normal. */}
      {rien && <p className={s.vide}>{p.copie.etatVide}</p>}

      {/* D2 — le refus de correction après révocation, annoncé D'AVANCE. */}
      {!p.correctionPossible && !rien && (
        <p className={s.refus} data-testid="correction-refusee">
          {p.copie.correctionRefusee}
        </p>
      )}

      <ul className={s.liste}>
        {faits.map((f) => (
          <li key={f.cle} className={s.fait}>
            {enEdition === f.cle ? (
              <>
                <textarea
                  className={s.champ}
                  rows={3}
                  aria-label={p.copie.corriger}
                  value={brouillon}
                  onChange={(e) => setBrouillon(e.target.value)}
                />
                <div className={s.actions}>
                  <button type="button" className={s.bouton} onClick={() => void enregistrer(f)}>
                    {p.copie.enregistrer}
                  </button>
                  <button type="button" className={s.bouton} onClick={() => setEnEdition(null)}>
                    {p.copie.renoncer}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={s.phrase}>{f.contenu}</p>
                <p className={s.meta}>
                  {jourLisible(f.jour) ?? f.jour}
                  {f.corrige ? ` · ${p.copie.mentionCorrige}` : ""}
                </p>

                {/* D5 — la source s'AFFICHE, elle ne se « lie » pas : il n'existe aucune ancre par
                    message dans la conversation, et un lien qui ne mène nulle part est un reproche
                    (leçon 4.10). */}
                <details className={s.source}>
                  <summary>{p.copie.voirSource}</summary>
                  {f.source ? (
                    <p className={s.sourceTexte}>{f.source.texte}</p>
                  ) : (
                    <p className={s.sourceTexte}>{p.copie.sourceAbsente}</p>
                  )}
                </details>

                <div className={s.actions}>
                  {p.correctionPossible && (
                    <button
                      type="button"
                      className={s.bouton}
                      onClick={() => {
                        setEnEdition(f.cle);
                        setBrouillon(f.contenu);
                      }}
                    >
                      {p.copie.corriger}
                    </button>
                  )}
                  {/* ⚠️ « Supprimer » N'EST JAMAIS CONDITIONNÉ. Même après révocation, même si tout
                      le reste est refusé : l'effacement est un droit qui survit à tout (art. 17), et
                      la base est construite pour le laisser passer (4.2). */}
                  <button type="button" className={s.bouton} onClick={() => void supprimer(f)}>
                    {p.copie.supprimer}
                  </button>
                </div>
              </>
            )}
            {/* ⚠️ LE REFUS VIT HORS DU TERNAIRE, et il y est arrivé par un test qui a rougi. Rendu
                dans la branche « pas en édition », il était invisible exactement quand il sert :
                une correction refusée laissait le champ ouvert, sans un mot pour dire pourquoi.
                Quelqu'un aurait cliqué « Enregistrer » trois fois avant de conclure à une panne. */}
            {refus[f.cle] && (
              <p className={s.refus} role="status">
                {refus[f.cle]}
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* AC3 — la fenêtre d'annulation. `role="status"` : l'annonce ne vole pas le focus. */}
      {Object.keys(annulables).map((cle) => (
        <p key={cle} className={s.refus} role="status" data-testid="annulation">
          {p.copie.supprimeAnnonce}{" "}
          <button type="button" className={s.bouton} onClick={() => void annuler(cle)}>
            {p.copie.annuler}
          </button>
        </p>
      ))}
    </>
  );
}

/**
 * ⚠️ RECOPIÉ, PAS IMPORTÉ — `render/` ne peut pas importer `lib/domain` (AD-7). La valeur qui fait
 * foi est `FENETRE_ANNULATION_MS` de `lib/domain/memoire-retenue.ts`, et une garde
 * (`tests/memoire-retenue.test.ts`) vérifie que les deux littéraux sont égaux : c'est le prix de la
 * frontière, et le seul moyen de le payer sans divergence est de le mesurer.
 */
const FENETRE_ANNULATION_MS_CLIENT = 10_000;
