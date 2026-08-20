import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { dimensionnerTout } from "./_outils";
import { CHEMIN_TRONC } from "@/render/arbre/Tronc";
import ArbreInteractif from "@/render/arbre/ArbreInteractif";
import {
  ACTION_AJOUTER_HEURE,
  ACTION_OU_TROUVER,
  ARIA_TRONC_A_COMPLETER,
  URL_HEURE_NAISSANCE,
  BASCULE_LISTE,
} from "@/render/arbre/copie-arbre";
import { MESSAGE_SANS_HEURE, OU_TROUVER_SON_HEURE } from "@/lib/domain/message-sans-heure";
import type { BrancheProjetee, ProjectionScene } from "@/lib/scene/projection";

/**
 * Story 5.3 (T6) — LE TRONC INCOMPLET ET SA FICHE, MONTÉS POUR DE VRAI.
 *
 * ══ POURQUOI CE FICHIER EST DANS LE PROJET `rendu` ═══════════════════════════════════════════════
 *
 * La re-revue 4.6 a démontré qu'une garde de rendu par LECTURE DE SOURCE prouve le câblage et jamais
 * le comportement : un `useEffect` correctement écrit, mais dont le tableau de dépendances
 * l'empêchait de rejouer, laissait l'arbre invisible sans qu'une seule garde rougisse. Ici on monte
 * le composant, on clique, on lit ce qui est à l'écran.
 *
 * ══ CE QUI EST GARDÉ ═════════════════════════════════════════════════════════════════════════════
 *
 *   AC5 — la fiche porte EXACTEMENT deux actions. Ni trois (« Plus tard »), ni une.
 *   AC4 — un tronc complet n'a AUCUNE affordance : rien à ouvrir, rien à fermer, rien à animer.
 *   AC3 — le mot « incomplet » n'atteint jamais l'écran, `aria-label` compris.
 *   UX-DR-37 — le chemin existe dans les TROIS états de la région (canevas, vide, liste), sans quoi
 *              il serait inatteignable pour qui n'a pas encore de branche ou navigue au clavier.
 */

const INCOMPLET = {
  phrase: MESSAGE_SANS_HEURE,
  ouTrouver: OU_TROUVER_SON_HEURE,
} as const;

const BRANCHE: BrancheProjetee = {
  id: "b1",
  etat: "naissance",
  intensite: 0,
  extraitSourceId: "e1",
  nom: "un nom",
};

const AVEC_BRANCHE_INCOMPLET: ProjectionScene = {
  tronc: { present: true, incomplet: INCOMPLET },
  branches: [BRANCHE],
};
const AVEC_BRANCHE_COMPLET: ProjectionScene = {
  tronc: { present: true },
  branches: [BRANCHE],
};
const VIDE_INCOMPLET: ProjectionScene = {
  tronc: { present: true, incomplet: INCOMPLET },
  branches: [],
};

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

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC5 — exactement deux actions
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.3 / AC5] la fiche du tronc porte EXACTEMENT deux actions", () => {
  it("[LE CŒUR] « Ajouter mon heure » et « Où la trouver », et rien d'autre", async () => {
    const u = userEvent.setup();
    monter(AVEC_BRANCHE_INCOMPLET);
    await u.click(screen.getByRole("button", { name: ARIA_TRONC_A_COMPLETER }));

    // PRÉSENCE D'ABORD : on prouve que la fiche est bien ouverte avant de compter ses actions.
    expect(screen.getByText(MESSAGE_SANS_HEURE)).toBeTruthy();

    // Tout ce qui est cliquable DANS la fiche, hors la croix de fermeture (qui n'est pas une
    // « action » au sens d'AC5 : elle referme, elle ne propose rien).
    const fiche = screen.getByText(MESSAGE_SANS_HEURE).closest("div")!;
    const actions = [
      ...fiche.querySelectorAll("a, button"),
    ].filter((el) => el.getAttribute("aria-label") !== "Fermer");

    expect(
      actions.map((el) => el.textContent?.trim()),
      "AC5 : ni une troisième action, ni une de moins",
    ).toEqual([ACTION_AJOUTER_HEURE, ACTION_OU_TROUVER]);
  });

  it("« Ajouter mon heure » mène à la saisie — un chemin, pas un cul-de-sac", async () => {
    const u = userEvent.setup();
    monter(AVEC_BRANCHE_INCOMPLET);
    await u.click(screen.getByRole("button", { name: ARIA_TRONC_A_COMPLETER }));
    const lien = screen.getByRole("link", { name: ACTION_AJOUTER_HEURE });
    expect(lien.getAttribute("href")).toBe(URL_HEURE_NAISSANCE);
  });

  it("« Où la trouver » RÉVÈLE SUR PLACE — la mairie, et l'extrait simple qui ne suffit pas", async () => {
    const u = userEvent.setup();
    monter(AVEC_BRANCHE_INCOMPLET);
    await u.click(screen.getByRole("button", { name: ARIA_TRONC_A_COMPLETER }));

    // Avant le clic, l'indication n'est PAS là : sinon le bouton ne servirait à rien.
    expect(screen.queryByText(OU_TROUVER_SON_HEURE)).toBeNull();
    await u.click(screen.getByRole("button", { name: ACTION_OU_TROUVER }));
    expect(screen.getByText(OU_TROUVER_SON_HEURE)).toBeTruthy();
  });

  it("Échap referme la fiche, et le focus revient au tronc", async () => {
    const u = userEvent.setup();
    monter(AVEC_BRANCHE_INCOMPLET);
    const tronc = screen.getByRole("button", { name: ARIA_TRONC_A_COMPLETER });
    await u.click(tronc);
    expect(screen.queryByText(MESSAGE_SANS_HEURE)).toBeTruthy();
    await u.keyboard("{Escape}");
    expect(screen.queryByText(MESSAGE_SANS_HEURE)).toBeNull();
    // Sans le retour du focus, la navigation clavier repart du début du document (revue 4.6).
    await vi.waitFor(() => expect(document.activeElement).toBe(tronc));
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC4 — un tronc complet n'a rien de plus
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.3 / AC4 / DUR] quand rien ne manque, il n'y a RIEN à voir", () => {
  it("aucune affordance, aucun texte, aucune fiche atteignable", () => {
    // Mutation-cible : rendre le bouton en permanence. Le tronc « complet » n'est pas un état
    // spécial : c'est le tronc. C'est ce qui rend vraie par construction la promesse « il passe à
    // complet sans animation ni déblocage » — il n'y a rien à animer, un drapeau disparaît.
    monter(AVEC_BRANCHE_COMPLET);
    expect(screen.queryByRole("button", { name: ARIA_TRONC_A_COMPLETER })).toBeNull();
    expect(screen.queryByText(MESSAGE_SANS_HEURE)).toBeNull();
  });

  it("[LE PIÈGE] une fiche OUVERTE se referme si l'heure arrive entre deux rendus", async () => {
    // Elle ouvre la fiche, part la remplir dans un autre onglet, revient : la projection serveur a
    // changé. Sans ce garde-fou, la fiche resterait affichée sur une phrase devenue FAUSSE — « il me
    // manque ton heure » à quelqu'un qui vient précisément de la donner.
    const u = userEvent.setup();
    const vue = monter(AVEC_BRANCHE_INCOMPLET);
    await u.click(screen.getByRole("button", { name: ARIA_TRONC_A_COMPLETER }));
    expect(screen.queryByText(MESSAGE_SANS_HEURE)).toBeTruthy();

    vue.rerender(
      <ArbreInteractif
        projection={AVEC_BRANCHE_COMPLET}
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
    expect(screen.queryByText(MESSAGE_SANS_HEURE), "la fiche survit à sa raison d'être").toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// UX-DR-37 — le chemin existe dans les TROIS états de la région
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.3 / UX-DR-37] le tronc est atteignable dans les trois états, pas seulement au canevas", () => {
  it("ARBRE VIDE : la personne qui n'a aucune branche est justement celle qui n'a pas donné son heure", async () => {
    // L'état vide REMPLACE le canevas. Un chemin qui n'existerait que sur le dessin serait
    // inatteignable pour elle — c'est-à-dire pour la cible exacte de cette story.
    const u = userEvent.setup();
    monter(VIDE_INCOMPLET);
    const tronc = screen.getByRole("button", { name: ARIA_TRONC_A_COMPLETER });
    await u.click(tronc);
    expect(screen.getByText(MESSAGE_SANS_HEURE)).toBeTruthy();
  });

  it("VUE LISTE : le doublage non spatial est de RANG ÉGAL, pas un résumé", async () => {
    // Même défaut que celui trouvé en revue 4.6 sur le renommage : un geste qui n'existe qu'au
    // canevas n'existe pas pour qui navigue au clavier ou au lecteur d'écran.
    const u = userEvent.setup();
    monter(AVEC_BRANCHE_INCOMPLET);
    await u.click(screen.getByRole("button", { name: BASCULE_LISTE }));
    const tronc = screen.getByRole("button", { name: ARIA_TRONC_A_COMPLETER });
    await u.click(tronc);
    expect(screen.getByText(MESSAGE_SANS_HEURE)).toBeTruthy();
  });

  it("…et il disparaît des trois états quand rien ne manque", async () => {
    const u = userEvent.setup();
    // ⚠️ `render` AJOUTE au document : sans démontage, les deux arbres coexistent et `getByRole`
    // trouve deux « Vue liste ». (Écrit d'abord sans, corrigé par le test lui-même.)
    const vide = monter({ tronc: { present: true }, branches: [] });
    expect(screen.queryByRole("button", { name: ARIA_TRONC_A_COMPLETER })).toBeNull();
    vide.unmount();

    const canevas = monter(AVEC_BRANCHE_COMPLET);
    expect(screen.queryByRole("button", { name: ARIA_TRONC_A_COMPLETER })).toBeNull();
    await u.click(screen.getByRole("button", { name: BASCULE_LISTE }));
    expect(screen.queryByRole("button", { name: ARIA_TRONC_A_COMPLETER })).toBeNull();
    canevas.unmount();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC3 — le mot n'atteint jamais l'écran
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.3 / AC3 / DUR] le mot « incomplet » n'est nulle part, aria compris", () => {
  it("ni dans le DOM du canevas, ni dans celui de la fiche ouverte", async () => {
    // `tests/tronc-absence.test.ts` garde le VOCABULAIRE par lecture de source ; ici on garde le DOM
    // RÉELLEMENT RENDU. Les deux sont nécessaires : l'un attrape une constante, l'autre une chaîne
    // construite à la volée.
    const u = userEvent.setup();
    const vue = monter(AVEC_BRANCHE_INCOMPLET);
    expect(vue.container.innerHTML).not.toMatch(/incomplet/i);
    await u.click(screen.getByRole("button", { name: ARIA_TRONC_A_COMPLETER }));
    expect(vue.container.innerHTML, "le mot a fui dans la fiche").not.toMatch(/incomplet/i);

    // …et aucun des signaux qu'AC2 interdit. Le VOCABULAIRE est cherché dans tout le balisage
    // (un nom de classe `pointille` est exactement ce qu'on veut attraper) ; le POURCENTAGE, lui,
    // seulement dans le TEXTE VISIBLE — `left: 50%` est du placement CSS, pas une jauge, et
    // l'interdire dans le balisage aurait rendu la garde absurde tout en la faisant paraître stricte.
    expect(vue.container.innerHTML).not.toMatch(/cadenas|verrou|dashed|pointill/i);
    expect(vue.container.textContent ?? "", "un pourcentage s'affiche").not.toMatch(/\d\s*%/);
  });

  it("[NON-VACUITÉ] le DOM examiné contient bien ce qu'on croit examiner", () => {
    // Un composant qui rendrait `null` passerait toutes les absences ci-dessus.
    const vue = monter(AVEC_BRANCHE_INCOMPLET);
    expect(vue.container.innerHTML).toContain(ARIA_TRONC_A_COMPLETER);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Story 5.6 (T9) — LE TRONC EST DESSINÉ MÊME QUAND L'ARBRE EST VIDE (FR-088, dette de la 3.3)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.6/AC9 · FR-088] l'état vide dessine le tronc", () => {
  /**
   * ⚠️ CE MANQUE EST RESTÉ INVISIBLE PENDANT TROIS STORIES, et pour une raison instructive : la 5.3
   * a rendu la FICHE du tronc atteignable dans les trois états, donc rien n'était inaccessible.
   * Seul le DESSIN manquait — et il manquait exactement au moment où FR-088 compte le plus, le
   * premier jour, quand aucune branche n'existe encore.
   *
   * L'état vide REMPLACE le canevas (vérifié : le mutant qui retire le tronc de `EtatVideArbre`
   * rougit ces trois tests, donc le canevas n'est bien pas rendu en parallèle).
   */
  const VIDE: ProjectionScene = { tronc: { present: true }, branches: [] };
  /**
   * ⚠️ LE CHEMIN EST IMPORTÉ, PAS RECOPIÉ — ET C'EST UN REDESSIN QUI L'A EXIGÉ. Cette garde gravait
   * `"M 500 950 L 500 560"`. Le 2026-08-20, la base du tronc est descendue de quatre pixels pour
   * naître d'une graine, et la garde a annoncé « aucun tronc dessiné » sur un écran qui en montrait
   * un. Ce qu'elle doit prouver, c'est qu'un tronc EST DESSINÉ ; le tracé exact est du dessin, et le
   * dessin a le droit de changer sans qu'un test se prenne pour un cahier des charges graphique.
   */
  const cheminsTronc = (c: HTMLElement) =>
    Array.from(c.querySelectorAll("path")).filter(
      (p) => (p.getAttribute("d") ?? "") === CHEMIN_TRONC,
    );

  it("[« OÙ EST SA GRAINE ? »] la base porte une graine, et les racines DESCENDENT", () => {
    // ⚠️ RETOUR DU 2026-08-20, MOT POUR MOT. L'ancien chemin partait de la base vers (430, 880) et
    // (570, 880) — vers le HAUT, en repère SVG. Un trait vertical surmonté de deux obliques qui
    // remontent : une pointe de flèche. Personne ne l'avait lu comme un arbre, et la question posée
    // était la bonne.
    //
    // Deux propriétés distinctes, parce qu'aucune ne suffit : la graine EXISTE (une surface pleine,
    // la seule du dessin), et les racines vont vers le BAS (`y` plus grand que la base du tronc).
    const { container } = monter(VIDE);
    const graine = container.querySelector("circle[class*='graine']");
    expect(graine, "aucune graine : le dessin n’a pas de point de départ").not.toBeNull();

    const ordonnees = [...CHEMIN_TRONC.matchAll(/[ML]\s+\d+\s+(\d+)|,?\s(\d+)\s(\d+)(?=\s|$)/g)];
    expect(ordonnees.length, "témoin : le chemin n’a pas pu être lu").toBeGreaterThan(0);
    // La base du tronc, d'où tout part.
    const base = Number(/M\s+500\s+(\d+)\s+L/.exec(CHEMIN_TRONC)?.[1]);
    expect(Number.isFinite(base), "témoin : la base du tronc est introuvable").toBe(true);
    const finsDeRacines = [...CHEMIN_TRONC.matchAll(/C[^MLC]*?(\d+)\s+(\d+)(?=\s|$)/g)].map((m) =>
      Number(m[2]),
    );
    expect(finsDeRacines.length, "témoin : aucune racine dans le chemin").toBeGreaterThan(1);
    const quiRemontent = finsDeRacines.filter((y) => y <= base);
    expect(
      quiRemontent,
      `des racines finissent AU-DESSUS de la base (${quiRemontent.join(", ")} ≤ ${base}) : ` +
        "le dessin redevient une flèche",
    ).toEqual([]);
  });

  it("[LE TEST QUI COMPTE] un arbre sans branche montre quand même un tronc", () => {
    const { container } = monter(VIDE);
    expect(
      cheminsTronc(container).length,
      "aucun tronc dessiné dans l'état vide — FR-088 dit « elle voit son tronc, y compris incomplet »",
    ).toBeGreaterThan(0);
  });

  it("le tronc de l'état vide est en RÉSERVE quand l'heure manque, entier sinon", () => {
    const classes = (c: HTMLElement) =>
      cheminsTronc(c)
        .map((p) => p.getAttribute("class") ?? "")
        .join(" ");
    const complet = classes(monter(VIDE).container);
    const incomplet = classes(monter(VIDE_INCOMPLET).container);
    expect(complet, "témoin : le tronc complet est bien dessiné").toContain("tronc");
    expect(incomplet, "la matière en réserve ne se distingue pas (5.3/AC3)").not.toBe(complet);
  });

  it("[5.3-AC3] le tronc dessiné n'ANNONCE rien — « incomplet » n'atteint jamais l'écran", () => {
    // L'écran vide dit déjà en toutes lettres ce qu'il a à dire, et le chemin vers la fiche passe
    // par un bouton nommé. Un tronc annoncé ferait entendre deux fois la même chose.
    const { container } = monter(VIDE_INCOMPLET);
    expect(cheminsTronc(container).length, "témoin : le tronc est bien là").toBeGreaterThan(0);
    for (const el of Array.from(container.querySelectorAll("svg"))) {
      expect((el.getAttribute("aria-label") ?? "").toLowerCase()).not.toContain("incomplet");
    }
  });
});
