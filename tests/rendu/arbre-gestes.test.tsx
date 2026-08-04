import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ArbreInteractif from "@/render/arbre/ArbreInteractif";
import { ACTION_RENOMMER, ACTION_CENTRER, CHAMP_RENOMMER_LABEL } from "@/render/arbre/copie-arbre";
import type { BrancheProjetee, ProjectionScene } from "@/lib/scene";
import { dimensionnerTout } from "./_outils";

/**
 * Story 4.6 — LES GESTES sur le canevas, montés pour de vrai. Quatre défauts de la RE-REVUE, tous
 * indétectables en lisant la source :
 *  • les zones cliquables faisaient 44 px CONSTANTS pendant que l'écartement entre branches décroît en 1/N :
 *    à partir d'une dizaine de branches, on ouvrait la fiche de LA VOISINE ;
 *  • le canevas étant l'ANCÊTRE de la fiche, les flèches et les glissers émis DANS le champ de renommage
 *    remontaient au canevas et déplaçaient l'arbre au lieu du curseur ;
 *  • sans capture de pointeur, un bouton relâché hors du canevas laissait l'arbre suivre le curseur ;
 *  • le recadrage au double-clic ne pouvait JAMAIS se déclencher (la couche de fiche captait le 2e appui).
 */

const branche = (i: number): BrancheProjetee => ({
  id: `b${i}`,
  etat: "naissance",
  intensite: 0,
  extraitSourceId: `extrait-${i}`,
  nom: `branche ${i}`,
  dateNaissance: "2026-03-11T10:00:00.000Z",
});

const scene = (n: number): ProjectionScene => ({
  tronc: { present: true },
  branches: Array.from({ length: n }, (_, i) => branche(i)),
});

function monter(n: number, extra: Partial<Record<string, unknown>> = {}) {
  dimensionnerTout(800, 600);
  const props = {
    projection: scene(n),
    camera: { pan: { x: 0, y: 0 }, zoom: 1 },
    brancheSelectionnee: null as string | null,
    onCadrer: vi.fn(),
    onOuvrirFiche: vi.fn(),
    onFermerFiche: vi.fn(),
    onVoirDansConversation: vi.fn(),
    onRenommer: vi.fn(async () => true),
    ...extra,
  };
  const vue = render(<ArbreInteractif {...props} />);
  return { ...vue, props };
}

/** Les accroches, avec leur position (en % de la boîte carrée) et leur taille à l'écran (px). */
function accroches() {
  return screen.getAllByRole("button", { name: /^Branche : / }).map((b) => {
    const el = b as HTMLElement;
    return {
      el,
      gauchePct: parseFloat(el.style.left),
      hautPct: parseFloat(el.style.top),
      taille: parseFloat(el.style.width) || 44,
    };
  });
}

describe("[HAUTE / re-revue] une cible n'ouvre JAMAIS la branche voisine", () => {
  for (const n of [2, 9, 15, 25]) {
    it(`à ${n} branches, deux zones cliquables ne se recouvrent pas`, () => {
      monter(n);
      const COTE = 600; // min(800, 600) — le carré effectif mesuré
      const a = accroches();
      expect(a).toHaveLength(n);

      for (let i = 0; i < a.length; i++) {
        for (let j = i + 1; j < a.length; j++) {
          const dx = ((a[i].gauchePct - a[j].gauchePct) / 100) * COTE;
          const dy = ((a[i].hautPct - a[j].hautPct) / 100) * COTE;
          const distance = Math.hypot(dx, dy);
          const recouvrement = (a[i].taille + a[j].taille) / 2;
          expect(
            distance,
            `à ${n} branches, les cibles ${i} et ${j} se recouvrent (${distance.toFixed(1)} px pour ${recouvrement.toFixed(1)} px de cible)`,
          ).toBeGreaterThanOrEqual(recouvrement);
        }
      }
    });
  }

  it("une branche SEULE garde une cible pleine taille (44 px)", () => {
    monter(1);
    expect(accroches()[0].taille).toBe(44);
  });

  it("ZOOMER fait REGRANDIR les cibles (l'écartement à l'écran croît avec le zoom)", () => {
    const { unmount } = monter(15);
    const petite = accroches()[0].taille;
    unmount();

    monter(15, { camera: { pan: { x: 0, y: 0 }, zoom: 3 } });
    const grande = accroches()[0].taille;
    expect(grande, "zoomer doit rendre les branches denses adressables").toBeGreaterThan(petite);
  });
});

describe("[re-revue] un geste fait DANS la fiche n'est pas un geste sur l'arbre", () => {
  it("les flèches tapées dans le champ de renommage ne déplacent PAS l'arbre", async () => {
    const u = userEvent.setup();
    const { props } = monter(3, { brancheSelectionnee: "b0" });

    await u.click(screen.getByRole("button", { name: ACTION_RENOMMER }));
    const champ = await screen.findByLabelText(CHAMP_RENOMMER_LABEL);
    await u.type(champ, "un nom");
    props.onCadrer.mockClear();

    await u.keyboard("{ArrowLeft}{ArrowRight}{ArrowUp}{ArrowDown}");
    expect(props.onCadrer, "les flèches ont déplacé l'arbre au lieu du curseur").not.toHaveBeenCalled();
  });

  it("un glisser commencé DANS la fiche ne déplace pas l'arbre", async () => {
    const u = userEvent.setup();
    const { props } = monter(3, { brancheSelectionnee: "b0" });
    await u.click(screen.getByRole("button", { name: ACTION_RENOMMER }));
    const champ = await screen.findByLabelText(CHAMP_RENOMMER_LABEL);
    props.onCadrer.mockClear();

    fireEvent.pointerDown(champ, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(champ, { pointerId: 1, clientX: 200, clientY: 160 });
    expect(props.onCadrer, "sélectionner du texte a fait glisser l'arbre").not.toHaveBeenCalled();
  });
});

describe("[re-revue] le pointeur est CAPTURÉ : un relâchement hors cadre n'arme pas un pan fantôme", () => {
  it("après un pointerup, un mouvement de souris SANS bouton ne déplace plus l'arbre", () => {
    const { props, container } = monter(3);
    const canevas = container.querySelector("[role='group']") as HTMLElement;

    fireEvent.pointerDown(canevas, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canevas, { pointerId: 1, clientX: 200, clientY: 200 });
    expect(props.onCadrer, "le pan normal doit fonctionner").toHaveBeenCalled();

    fireEvent.pointerUp(canevas, { pointerId: 1, clientX: 200, clientY: 200 });
    props.onCadrer.mockClear();
    fireEvent.pointerMove(canevas, { pointerId: 1, clientX: 400, clientY: 400 });
    expect(props.onCadrer, "l'arbre suit le curseur sans bouton pressé").not.toHaveBeenCalled();
  });
});

describe("[re-revue] le recadrage d'une branche est ATTEIGNABLE", () => {
  it("la fiche porte une action de recadrage, qui ferme la fiche ET cadre", async () => {
    const u = userEvent.setup();
    const { props } = monter(3, { brancheSelectionnee: "b1" });

    await u.click(screen.getByRole("button", { name: ACTION_CENTRER }));
    expect(props.onFermerFiche).toHaveBeenCalled();
    await waitFor(() => expect(props.onCadrer).toHaveBeenCalled());
    const camera = props.onCadrer.mock.calls.at(-1)![0] as { zoom: number };
    expect(camera.zoom, "le recadrage doit rapprocher").toBeGreaterThan(1);
  });

  it("le double-clic MORT a bien disparu de l'accroche", () => {
    monter(3);
    // Un double-clic ne doit plus rien tenter : il ouvrait la fiche, puis son 2e appui était capté par la
    // couche de fiche. On vérifie qu'il n'appelle pas `onCadrer` (l'ancien comportement mort).
    const { props } = monter(3);
    fireEvent.dblClick(accroches()[0].el);
    expect(props.onCadrer).not.toHaveBeenCalled();
  });
});
