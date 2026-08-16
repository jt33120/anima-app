import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Memoire, { type ProprietesMemoire } from "@/render/memoire/Memoire";
import * as COPIE from "@/lib/domain/copie-memoire";
import { FENETRE_ANNULATION_MS } from "@/lib/domain/memoire-retenue";

/**
 * memoire.test.tsx — « CE QU'ANAM RETIENT », MONTÉ POUR DE VRAI (Story 6.5, AC1/AC2/AC3/AC5 · D2).
 *
 * `memoire-sql.test.ts` prouve que la base tient. Ce fichier prouve la chose complémentaire : ce qui
 * atteint l'écran, et surtout ce qui reste ATTEIGNABLE quand tout le reste est refusé.
 */

const COPIE_VUE = {
  etatVide: COPIE.ETAT_VIDE,
  corriger: COPIE.ACTION_CORRIGER,
  supprimer: COPIE.ACTION_SUPPRIMER,
  enregistrer: COPIE.ACTION_ENREGISTRER,
  renoncer: COPIE.ACTION_RENONCER,
  annuler: COPIE.ACTION_ANNULER,
  voirSource: COPIE.VOIR_SOURCE,
  sourceAbsente: COPIE.SOURCE_ABSENTE,
  mentionCorrige: COPIE.MENTION_CORRIGE,
  supprimeAnnonce: COPIE.SUPPRIME_ANNONCE,
  correctionRefusee: COPIE.CORRECTION_APRES_REVOCATION,
};

const FAIT = {
  cle: "k-1",
  contenu: "Elle a quitté Paris au printemps.",
  corrige: false,
  jour: "2026-08-04",
  source: { texte: "J'ai quitté Paris en mars, et je ne le regrette pas.", jour: "2026-03-12" },
};

function proprietes(sur: Partial<ProprietesMemoire> = {}): ProprietesMemoire {
  return {
    copie: COPIE_VUE,
    faits: [FAIT],
    correctionPossible: true,
    corriger: vi.fn(async () => ({ statut: "ok" as const })),
    supprimer: vi.fn(async () => ({ statut: "ok" as const })),
    annuler: vi.fn(async () => ({ statut: "ok" as const })),
    ...sur,
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("[6.5/AC1] ce que la liste montre, et ce qu'elle ne montre pas", () => {
  it("la phrase, sa date en clair, et son extrait source", async () => {
    render(<Memoire {...proprietes()} />);
    expect(screen.getByText(FAIT.contenu)).toBeDefined();
    // La date est LISIBLE, pas un ISO : « 4 août 2026 ».
    expect(screen.getByText(/4 août 2026/)).toBeDefined();
    expect(screen.getByText(FAIT.source.texte)).toBeDefined();
  });

  it("[LE CŒUR] AUCUN chiffre autre que la date — jamais de score", async () => {
    // ⚠️ Mutation-cible : afficher une confiance. Le type l'interdit déjà (aucun champ ne la porte) ;
    // ceci attrape la dérivation à partir de rien. « Anam est sûre à 82 % que tu n'aimes pas ton
    // travail » est une phrase qu'aucune personne ne devrait avoir à lire sur elle-même.
    const { container } = render(<Memoire {...proprietes()} />);
    const texte = (container.textContent ?? "").replace(/4 août 2026/g, "");
    expect(texte, "un chiffre autre que la date est apparu").not.toMatch(/\d/);
    for (const mot of [/\bscore\b/i, /\bconfiance\b/i, /\b%\b/, /\bcertitude\b/i]) {
      expect(mot.test(container.textContent ?? "")).toBe(false);
    }
  });

  it("une source absente se DIT, elle ne laisse pas un vide", async () => {
    render(<Memoire {...proprietes({ faits: [{ ...FAIT, source: null }] })} />);
    expect(screen.getByText(COPIE.SOURCE_ABSENTE)).toBeDefined();
  });

  it("[D6] un fait corrigé le dit — une correction est une donnée", async () => {
    render(<Memoire {...proprietes({ faits: [{ ...FAIT, corrige: true }] })} />);
    expect(screen.getByText(new RegExp(COPIE.MENTION_CORRIGE))).toBeDefined();
  });

  it("[AC5] l'état vide", async () => {
    render(<Memoire {...proprietes({ faits: [] })} />);
    expect(screen.getByText(COPIE.ETAT_VIDE)).toBeDefined();
  });
});

describe("[6.5/AC2] corriger en place", () => {
  it("le bouton ouvre un champ pré-rempli, et l'enregistrement part avec l'ANCIEN texte", async () => {
    // ⚠️ L'ancien texte accompagne la correction : c'est ce qui permet de refuser une réécriture à
    // l'identique — laquelle changerait l'`origine` du fait, donc le soustrairait à toute
    // ré-extraction future, sans que rien n'ait changé de son sens.
    const p = proprietes();
    render(<Memoire {...p} />);
    await userEvent.click(screen.getByRole("button", { name: COPIE.ACTION_CORRIGER }));

    const champ = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(champ.value).toBe(FAIT.contenu);
    await userEvent.clear(champ);
    await userEvent.type(champ, "Elle a quitté Paris en mars.");
    await userEvent.click(screen.getByRole("button", { name: COPIE.ACTION_ENREGISTRER }));

    expect(p.corriger).toHaveBeenCalledWith("k-1", "Elle a quitté Paris en mars.", FAIT.contenu);
  });

  it("un refus s'AFFICHE et le champ reste ouvert — on ne perd pas ce qui vient d'être écrit", async () => {
    const p = proprietes({
      corriger: vi.fn(async () => ({ statut: "erreur" as const, message: COPIE.REFUS_VIDE })),
    });
    render(<Memoire {...p} />);
    await userEvent.click(screen.getByRole("button", { name: COPIE.ACTION_CORRIGER }));
    await userEvent.click(screen.getByRole("button", { name: COPIE.ACTION_ENREGISTRER }));

    await waitFor(() => expect(screen.getByText(COPIE.REFUS_VIDE)).toBeDefined());
    expect(screen.getByRole("textbox"), "le champ s'est refermé sur un refus").toBeDefined();
  });

  it("renoncer referme sans rien envoyer", async () => {
    const p = proprietes();
    render(<Memoire {...p} />);
    await userEvent.click(screen.getByRole("button", { name: COPIE.ACTION_CORRIGER }));
    await userEvent.click(screen.getByRole("button", { name: COPIE.ACTION_RENONCER }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(p.corriger).not.toHaveBeenCalled();
  });
});

describe("[6.5/AC3] supprimer, et les dix secondes pour revenir en arrière", () => {
  it("[LE CŒUR] la suppression part IMMÉDIATEMENT — elle n'est pas différée", async () => {
    // ⚠️ Mutation-cible : retarder l'appel de dix secondes pour pouvoir l'annuler avant qu'il parte.
    // C'est plus simple et c'est FAUX : si elle ferme l'onglet dans l'intervalle, elle croit avoir
    // effacé et rien n'a été effacé. Pour un droit à l'effacement, le sens de l'erreur n'est pas
    // négociable — et l'AC3 le dit au littéral, « la suppression est immédiate ».
    const p = proprietes();
    render(<Memoire {...p} />);
    await userEvent.click(screen.getByRole("button", { name: COPIE.ACTION_SUPPRIMER }));

    await waitFor(() => expect(p.supprimer).toHaveBeenCalledWith("k-1"));
    await waitFor(() => expect(screen.queryByText(FAIT.contenu)).toBeNull());
    expect(screen.getByTestId("annulation")).toBeDefined();
  });

  it("[LE CŒUR] annuler RE-DÉPOSE la phrase gardée en mémoire", async () => {
    // ⚠️ Ce n'est PAS un rembobinage, et ça ne peut pas l'être : le tombstone vide le contenu — c'est
    // sa raison d'être. Rien en base ne permettrait de le restaurer, et 4.2 a fermé exprès le chemin
    // de ré-activation. La phrase que le client garde dix secondes est la SEULE copie qui reste.
    const p = proprietes();
    render(<Memoire {...p} />);
    await userEvent.click(screen.getByRole("button", { name: COPIE.ACTION_SUPPRIMER }));
    await screen.findByTestId("annulation");
    await userEvent.click(screen.getByRole("button", { name: COPIE.ACTION_ANNULER }));

    expect(p.annuler).toHaveBeenCalledWith("k-1", FAIT.contenu);
    await waitFor(() => expect(screen.queryByTestId("annulation")).toBeNull());
  });

  it("[LE CŒUR] passé la fenêtre, l'offre d'annulation DISPARAÎT", async () => {
    // Une offre d'annulation qui resterait à l'écran indéfiniment est un mensonge poli : elle promet
    // un retour en arrière que plus rien ne garde.
    // ⚠️ Pas de `userEvent` ici : sa machinerie de pointeur pose ses propres délais, et sous horloge
    // factice elle attend un temps qui n'avance que si on l'avance — ce qui fige le test au lieu de
    // l'accélérer. Un clic natif dans `act` suffit ; c'est le `setTimeout` du composant qu'on éprouve.
    vi.useFakeTimers();
    render(<Memoire {...proprietes()} />);
    await act(async () => {
      screen.getByRole("button", { name: COPIE.ACTION_SUPPRIMER }).click();
    });
    expect(screen.getByTestId("annulation")).toBeDefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FENETRE_ANNULATION_MS + 100);
    });
    expect(screen.queryByTestId("annulation")).toBeNull();
  });
});

describe("[6.5/D2 DUR] après révocation : corriger est refusé, SUPPRIMER ne l'est jamais", () => {
  const revoquee = () => proprietes({ correctionPossible: false });

  it("[LE CŒUR] le bouton « Supprimer » est là, et il MARCHE", async () => {
    // ⚠️ C'EST LA GARDE LA PLUS IMPORTANTE DE CE FICHIER. Le réflexe d'harmonisation — « elle a tout
    // retiré, donc on désactive tout » — rendrait le droit à l'effacement (art. 17) inatteignable
    // exactement au moment où il sert. La Story 4.2 a construit la base pour laisser passer la
    // suppression après révocation ; désactiver le bouton annulerait tout ce soin depuis l'écran.
    const p = revoquee();
    render(<Memoire {...p} />);
    const bouton = screen.getByRole("button", { name: COPIE.ACTION_SUPPRIMER }) as HTMLButtonElement;
    expect(bouton.disabled, "le bouton de suppression a été désactivé").toBe(false);
    await userEvent.click(bouton);
    expect(p.supprimer).toHaveBeenCalledWith("k-1");
  });

  it("le bouton « Corriger » n'est PAS proposé, et le motif est dit d'avance", async () => {
    render(<Memoire {...revoquee()} />);
    expect(screen.queryByRole("button", { name: COPIE.ACTION_CORRIGER })).toBeNull();
    expect(screen.getByTestId("correction-refusee").textContent).toBe(
      COPIE.CORRECTION_APRES_REVOCATION,
    );
  });

  it("[ANTI-VACUITÉ] avec le consentement, « Corriger » EST proposé", async () => {
    // Sans ce contrôle, le test ci-dessus passerait aussi avec un bouton qui n'existe jamais.
    render(<Memoire {...proprietes()} />);
    expect(screen.getByRole("button", { name: COPIE.ACTION_CORRIGER })).toBeDefined();
    expect(screen.queryByTestId("correction-refusee")).toBeNull();
  });
});
