import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { dimensionnerTout } from "./_outils";
import ArbreInteractif from "@/render/arbre/ArbreInteractif";
import { VIDE_TITRE, VIDE_CORPS, VIDE_OU_NAISSENT_LES_BRANCHES, BASCULE_LISTE } from "@/render/arbre/copie-arbre";
import type { ProjectionScene } from "@/lib/scene/projection";

/**
 * Story 3.3 (T4, AC1 + AC2 [DUR]) — L'ARBRE D'UN COMPTE GRATUIT, MONTÉ POUR DE VRAI.
 *
 * ── POURQUOI CE TEST EST ÉCRIT COMME UNE DIFFÉRENCE, ET PAS COMME UNE LISTE D'INTERDITS ────────────────
 *
 * AC2 énumère ce qui ne doit PAS apparaître : cadenas, aperçu flouté, branches fantômes, bandeau
 * « passez au premium », compteur de branches manquantes. Une garde bâtie sur cette liste ne vaut que
 * la liste : le jour où quelqu'un ajoute une pastille « Essai », un dégradé grisé ou un chevron
 * « en savoir plus », elle reste verte — parce que ces mots-là n'y figurent pas.
 *
 * On assère donc la propriété DIRECTEMENT : la MÊME projection vide, rendue « comme gratuite » puis
 * « comme premium », produit le MÊME DOM — à une seule différence près, NOMMÉE : la phrase sobre d'AC6.
 * Rien d'autre ne peut se glisser entre les deux sans que ce fichier rougisse, quel que soit son nom.
 *
 * `tests/tronc-absence.test.ts` couvre l'autre moitié (le VOCABULAIRE interdit sur toutes les surfaces).
 * Les deux gardes sont complémentaires : celle-ci ne dépend d'aucun mot, celle-là ne dépend d'aucun DOM.
 */

const VIDE: ProjectionScene = { tronc: { present: true }, branches: [] };
/** Le même vide, vu par une abonnée : `planOuvert` est le SEUL champ qui change (0036 + 0037). */
const VIDE_PREMIUM: ProjectionScene = { ...VIDE, planOuvert: true };

function monter(projection: ProjectionScene) {
  dimensionnerTout(800, 800);
  return render(
    <ArbreInteractif
      projection={projection}
      camera={{ pan: { x: 0, y: 0 }, zoom: 1 }}
      brancheSelectionnee={null}
      onCadrer={vi.fn()}
      onOuvrirFiche={vi.fn()}
      onFermerFiche={vi.fn()}
      onVoirDansConversation={vi.fn()}
      onRenommer={vi.fn(async () => true)}
      onDeclarerRayonnement={vi.fn(async () => "ok" as const)}
    />,
  );
}

/**
 * Le DOM rendu, débarrassé de L'ÉLÉMENT ENTIER dont AC6 autorise la présence — pas seulement de son
 * texte. La première version de ce fichier retirait la chaîne seule et laissait un `<p></p>` vide
 * derrière elle ; la garde a rougi sur sa propre approximation, ce qui est exactement ce qu'on lui
 * demande de faire. Un « nettoyage » qui laisse une trace ne compare plus ce qu'il prétend comparer.
 */
function domSansLaPhrase(html: string): string {
  const echappee = VIDE_OU_NAISSENT_LES_BRANCHES.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(new RegExp(`<p[^>]*>${echappee}</p>`, "g"), "");
}

describe("[AC2 DUR] le vide d'un compte gratuit EST le vide d'un compte premium", () => {
  it("[NON-VACUITÉ] les deux rendus contiennent bien l'état vide qu'on croit comparer", () => {
    // ⚠️ LA CONDITION DE VALIDITÉ. Deux composants qui rendraient `null` produiraient deux DOM
    // identiques et feraient passer tout ce fichier au vert. On prouve d'abord qu'on compare
    // quelque chose : le titre et le corps de l'état vide sont là, des deux côtés.
    const gratuite = monter(VIDE);
    expect(gratuite.container.innerHTML).toContain(VIDE_TITRE);
    expect(gratuite.container.innerHTML).toContain(VIDE_CORPS);
    gratuite.unmount();
    const premium = monter(VIDE_PREMIUM);
    expect(premium.container.innerHTML).toContain(VIDE_TITRE);
    expect(premium.container.innerHTML).toContain(VIDE_CORPS);
  });

  it("[LE CŒUR] le DOM est IDENTIQUE, à la phrase sobre d'AC6 près — et rien d'autre", async () => {
    // Mutation-cible : ajouter N'IMPORTE QUOI au rendu gratuit — un cadenas, une classe `.floute`, une
    // pastille, un bouton, un `aria-label` différent. Ce test rougit sans avoir jamais eu à connaître
    // le nom de ce qu'on a ajouté. C'est ce qui le rend durable.
    const gratuite = monter(VIDE);
    const domGratuit = gratuite.container.innerHTML;
    gratuite.unmount();
    const premium = monter(VIDE_PREMIUM);
    const domPremium = premium.container.innerHTML;

    expect(domSansLaPhrase(domGratuit), "le vide gratuit diffère du vide premium ailleurs que sur AC6").toBe(
      domPremium,
    );
    // …et la seule différence est bien celle qu'AC6 autorise, pas une égalité obtenue par hasard.
    expect(domGratuit).not.toBe(domPremium);
    expect(domGratuit).toContain(VIDE_OU_NAISSENT_LES_BRANCHES);
    expect(domPremium, "une abonnée n'a rien à s'entendre expliquer").not.toContain(
      VIDE_OU_NAISSENT_LES_BRANCHES,
    );
  });

  it("[AC1] la bascule vue liste / vue arbre est offerte à l'identique, gratuite ou non", async () => {
    // ⚠️ CE TEST DISAIT « OFFERTE », ET IL VÉRIFIAIT « OFFERTE SUR UN ÉCRAN VIDE » — deux choses
    // différentes. Retour du 2026-08-20 : « à quoi correspond vue liste pour l'arbre ? ». La
    // question n'avait pas de réponse, parce que les deux vues d'un arbre SANS BRANCHE rendent
    // littéralement le même composant (`EtatVideArbre`) : le bouton changeait son libellé et rien
    // d'autre. Il ne s'affiche plus là.
    //
    // Ce que l'AC1 protège reste entier — la commande ne se DÉGRADE pas selon l'abonnement — et se
    // mesure là où elle a un sens : dès qu'il y a quelque chose à lister.
    const avecBranche: ProjectionScene = {
      tronc: { present: true },
      branches: [{ id: "b1", etat: "naissance" as const, intensite: 0, extraitSourceId: "e1", nom: "un nom" }],
    };
    monter(avecBranche);
    expect(screen.getByRole("button", { name: BASCULE_LISTE })).toBeTruthy();
    cleanup();
    monter({ ...avecBranche, planOuvert: true });
    expect(
      screen.getByRole("button", { name: BASCULE_LISTE }),
      "la commande se dégrade selon l’abonnement",
    ).toBeTruthy();
    await Promise.resolve();
  });

  it("[UN CONTRÔLE QUI NE FAIT RIEN N'EST PAS OFFERT] l'arbre vide n'a pas de bascule", () => {
    // La contrepartie de la ligne ci-dessus, et la garde du retour du 2026-08-20 : sur un écran où
    // les deux vues sont le MÊME écran, un bouton qui bascule enseigne qu'on n'a pas compris.
    monter(VIDE);
    expect(screen.queryByRole("button", { name: BASCULE_LISTE })).toBeNull();
    // Témoin : l'écran vide est bien monté — sans quoi l'absence ci-dessus ne prouverait rien.
    expect(screen.getByText(VIDE_TITRE)).toBeTruthy();
  });
});

describe("[AC6] la phrase sobre : quand elle est là, et surtout quand elle ne l'est pas", () => {
  it("dès qu'UNE branche existe, elle s'en va d'elle-même — aucune persistance, aucun marqueur", () => {
    // « Une seule fois » (D3-A) sans table ni colonne `vu_le` : la phrase n'apparaît jamais, elle EST là
    // tant que l'écran est vide. Fabriquer un marqueur en aurait fait un événement commercial daté (FR-057).
    monter({
      tronc: { present: true },
      branches: [{ id: "b1", etat: "naissance", intensite: 0, extraitSourceId: "e1", nom: "un nom" }],
    });
    expect(screen.queryByText(VIDE_OU_NAISSENT_LES_BRANCHES)).toBeNull();
  });

  it("[AD-9 DUR] en DÉTRESSE, rien de commercial ne se monte — pas même cette phrase", () => {
    // Mutation-cible : retirer `p.gestesSuspendus !== true` de `doitDireOuNaissentLesBranches`.
    // Le test ci-dessous (compte PREMIUM en détresse) est celui qui rend cette clause non redondante.
    monter({ ...VIDE, gestesSuspendus: true });
    expect(screen.queryByText(VIDE_OU_NAISSENT_LES_BRANCHES)).toBeNull();
  });

  it("[LE CŒUR de la clause détresse] une ABONNÉE en détresse ne la voit pas non plus", () => {
    // Sans la clause `gestesSuspendus`, une abonnée en détresse serait indiscernable d'un compte gratuit
    // (les deux ont `planOuvert` absent) et s'entendrait expliquer où naissent des branches qu'elle peut
    // déjà poser — au pire moment possible. C'est le seul test qui distingue les deux clauses.
    monter({ ...VIDE, gestesSuspendus: true, planOuvert: undefined });
    expect(screen.queryByText(VIDE_OU_NAISSENT_LES_BRANCHES)).toBeNull();
  });

  it("sur une PANNE de lecture, on ne fait pas de commerce sur un écran d'excuse", () => {
    // « Je n'arrive pas à afficher ton arbre » + « les branches se posent en conversation » serait
    // répondre à côté, à quelqu'un qu'on fait déjà patienter.
    monter({ ...VIDE, indisponible: true });
    expect(screen.queryByText(VIDE_OU_NAISSENT_LES_BRANCHES)).toBeNull();
  });

  it("[AC6] aucun élément INTERACTIF dans le bloc de la phrase : ni bouton, ni lien", () => {
    // Mutation-cible : envelopper la phrase d'un `<button>` ou d'un `<a href>`. AC6 dit « sans bouton
    // d'achat » — on va plus loin : rien à cliquer du tout, donc rien à refuser.
    monter(VIDE);
    const phrase = screen.getByText(VIDE_OU_NAISSENT_LES_BRANCHES);
    expect(phrase.tagName).toBe("P");
    const bloc = phrase.closest("div")!;
    expect(bloc.querySelectorAll("button, a, input, [role='button'], [role='link']").length).toBe(0);
  });
});
