import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ArbreInteractif from "@/render/arbre/ArbreInteractif";
import { PLAN_TITRE, PLAN_VIDE, BASCULE_LISTE, ACTION_AJOUTER_ETAPE } from "@/render/arbre/copie-arbre";
import type { BrancheProjetee, ProjectionScene } from "@/lib/scene";
import { dimensionnerTout } from "./_outils";

/**
 * Story 4.10 (T7) — [UX-DR-37] LE PLAN EST ATTEIGNABLE EN VUE LISTE, PAS SEULEMENT SUR LA FICHE.
 *
 * ⚠️ CE FICHIER EXISTE PARCE QUE LA CAMPAGNE DE MUTATION A TROUVÉ LE TROU. Le plan était monté dans
 * `FicheBranche`, et la fiche n'est rendue QUE dans la vue canevas. Rien ne rougissait quand on le
 * retirait de la vue liste — et c'est MOT POUR MOT le défaut que la revue 4.6 avait trouvé sur le
 * renommage : « un utilisateur clavier ne pouvait tout simplement pas renommer, et le rang égal d'AC8
 * était faux ». Le doublage non-spatial n'est de rang égal que si TOUT s'y fait aussi.
 */

const branche = (id: string): BrancheProjetee => ({
  id,
  etat: "naissance",
  intensite: 0,
  extraitSourceId: `extrait-${id}`,
  nom: `nom de ${id}`,
  dateNaissance: "2026-03-11T10:00:00.000Z",
});

const scene = (extra: Partial<ProjectionScene> = {}): ProjectionScene => ({
  tronc: { present: true },
  branches: [branche("b0"), branche("b1")],
  ...extra,
});

function poserFetch(plan: unknown[] = []) {
  const urls: string[] = [];
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
    urls.push(String(url));
    return new Response(JSON.stringify({ plan }), { status: 200 });
  }) as unknown as typeof fetch;
  return urls;
}

async function monterEnListe(projection: ProjectionScene) {
  dimensionnerTout(800, 600);
  render(
    <ArbreInteractif
      projection={projection}
      camera={{ pan: { x: 0, y: 0 }, zoom: 1 }}
      brancheSelectionnee={null}
      onCadrer={vi.fn()}
      onOuvrirFiche={vi.fn()}
      onFermerFiche={vi.fn()}
      onVoirDansConversation={vi.fn()}
      onRenommer={vi.fn(async () => true)}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: BASCULE_LISTE }));
}

afterEach(() => vi.unstubAllGlobals());

describe("[UX-DR-37] le doublage non-spatial est de RANG ÉGAL — le plan aussi", () => {
  it("[LE CŒUR] chaque branche listée offre un accès à son plan d'étapes", async () => {
    // Mutation-cible : retirer `PlanEtapes` de `VueListe`. La fiche continuerait de l'offrir, tous les
    // autres tests resteraient verts, et quelqu'un qui navigue au clavier ou au lecteur d'écran ne
    // pourrait tout simplement pas s'en servir.
    poserFetch();
    await monterEnListe(scene());
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(within(item).getByRole("button", { name: PLAN_TITRE }), "chaque branche, pas seulement la première")
        .toBeTruthy();
    }
  });

  it("le plan s'ouvre À LA DEMANDE — pas vingt requêtes d'art. 9 à l'entrée dans la liste", async () => {
    // Monter `PlanEtapes` pour chaque branche chargerait le contenu de TOUTES les branches dès la
    // bascule, pour du texte que personne n'a demandé à lire (minimisation). Mutation-cible : monter le
    // plan sans attendre le geste.
    const urls = poserFetch();
    await monterEnListe(scene());
    expect(urls.filter((u) => u.includes("/api/anam/plan")), "aucun plan chargé avant le geste").toHaveLength(0);

    await userEvent.click(screen.getAllByRole("button", { name: PLAN_TITRE })[0]);
    expect(await screen.findByText(PLAN_VIDE)).toBeTruthy();
    const charges = urls.filter((u) => u.includes("/api/anam/plan"));
    expect(charges, "UN seul plan chargé — celui qu'elle a ouvert").toHaveLength(1);
    expect(charges[0], "et c'est bien la branche demandée").toContain("brancheId=b0");
  });

  it("`planOuvert` vrai → le champ est offert ici comme sur la fiche", async () => {
    poserFetch();
    await monterEnListe(scene({ planOuvert: true }));
    await userEvent.click(screen.getAllByRole("button", { name: PLAN_TITRE })[0]);
    expect(await screen.findByRole("button", { name: ACTION_AJOUTER_ETAPE })).toBeTruthy();
  });

  it("[LE CŒUR] `planOuvert` absent → aucun champ, ici NON PLUS", async () => {
    // Mutation-cible : passer `ouvert` en dur à `true` dans `VueListe`. La vue liste deviendrait alors
    // la porte dérobée du premium — et pire, celle qui contourne la garde de détresse : elle offrirait
    // le champ à quelqu'un qui sort d'un épisode, puis le point d'écriture refuserait. Une garde qui
    // ne vaut que dans une des deux vues n'est pas une garde.
    poserFetch();
    await monterEnListe(scene());
    await userEvent.click(screen.getAllByRole("button", { name: PLAN_TITRE })[0]);
    await screen.findByText(PLAN_VIDE);
    expect(screen.queryByRole("button", { name: ACTION_AJOUTER_ETAPE }), "fermée → aucun champ").toBeNull();
  });
});

describe("[REVUE 4.10] la vue liste : « La voir » mène quelque part, et le plan se referme", () => {
  it("[LE CŒUR] la FICHE s'ouvre même en vue liste (le geste d'Anam ne bute pas)", async () => {
    // ⚠️ `FicheBranche` n'était montée que dans la branche CANEVAS du ternaire, et la préférence de vue
    // est persistée en localStorage. Une utilisatrice passée en liste une fois cliquait « La voir » sur
    // l'invitation d'Anam, arrivait sur la région arbre, et **rien ne s'ouvrait** — l'invitation
    // redevenait exactement ce que la story appelle « un reproche ».
    // Mutation-cible : remettre la fiche à l'intérieur de la branche canevas.
    poserFetch();
    dimensionnerTout(800, 600);
    render(
      <ArbreInteractif
        projection={scene()}
        camera={{ pan: { x: 0, y: 0 }, zoom: 1 }}
        brancheSelectionnee="b0"
        onCadrer={vi.fn()}
        onOuvrirFiche={vi.fn()}
        onFermerFiche={vi.fn()}
        onVoirDansConversation={vi.fn()}
        onRenommer={vi.fn(async () => true)}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: BASCULE_LISTE }));
    expect(
      await screen.findByRole("group", { name: "Fiche de branche" }),
      "la branche visée par l'invitation s'ouvre, quelle que soit la vue",
    ).toBeTruthy();
  });

  it("le bouton du plan BASCULE : il se referme, et le focus ne tombe pas sur <body>", async () => {
    // ⚠️ `boutonsPlan` était alimenté par un `ref` et JAMAIS lu : le bouton se démontait au clic, donc
    // l'élément focalisé disparaissait. Et `planOuvertPour` n'était jamais remis à `null` — une fois
    // ouvert, le plan ne se refermait plus de toute la session.
    // Mutation-cible : redémonter le bouton quand le plan est ouvert.
    poserFetch();
    await monterEnListe(scene());
    const bouton = screen.getAllByRole("button", { name: PLAN_TITRE })[0];
    await userEvent.click(bouton);
    await screen.findByText(PLAN_VIDE);
    expect(bouton.getAttribute("aria-expanded"), "l'état est annoncé").toBe("true");
    expect(document.activeElement, "le focus est resté sur le bouton").toBe(bouton);

    await userEvent.click(bouton);
    expect(screen.queryByText(PLAN_VIDE), "et il se referme").toBeNull();
    expect(bouton.getAttribute("aria-expanded")).toBe("false");
  });
});
