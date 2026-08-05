import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { dimensionnerTout } from "./_outils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import FicheBranche from "@/render/arbre/FicheBranche";
import type { BrancheProjetee } from "@/lib/scene/projection";
import type { ResultatGeste } from "@/render/arbre/FicheBranche";

/**
 * Story 4.7 (T5/T6) — le RENDU du cycle de vie, monté pour de vrai (jsdom + Testing Library).
 *
 * Une garde de source prouverait le câblage, jamais le comportement : c'est la leçon de la re-revue 4.6,
 * où un `useLayoutEffect` correctement écrit mais aux dépendances mal posées laissait l'arbre INVISIBLE
 * au scénario nominal sans qu'une seule garde rougisse. Ce qui est vérifié ici est donc VÉCU :
 *  - AC5 : le changement est DÉJÀ LÀ (aucune animation d'apparition), et la fiche dit quoi et QUAND ;
 *  - AC3 : le geste existe, il est explicite, confirmé, et absent quand la branche rayonne déjà ;
 *  - FR-031 : aucun chiffre de progression n'atteint l'écran.
 */

const BASE: BrancheProjetee = {
  id: "b1",
  etat: "naissance",
  intensite: 0,
  extraitSourceId: "e1",
  nom: "dire non à ma mère",
  dateNaissance: "2026-03-12T10:00:00Z",
  extraitContenu: "je n'arrive jamais à refuser",
};

function monter(
  branche: Partial<BrancheProjetee>,
  onDeclarer?: (id: string) => Promise<ResultatGeste>,
  gesteSuspendu = false,
) {
  const props = {
    branche: { ...BASE, ...branche },
    onFermer: vi.fn(),
    onVoirDansConversation: vi.fn(),
    onRenommer: vi.fn(async () => true),
    onAnnoncer: vi.fn(),
    gesteSuspendu,
    ...(onDeclarer ? { onDeclarerRayonnement: onDeclarer } : {}),
  };
  return { ...render(<FicheBranche {...props} />), props };
}

describe("[AC5] la fiche dit ce qui a changé ET QUAND", () => {
  it("une branche en feuillaison porte sa date de feuillaison", () => {
    monter({ etat: "feuillaison", intensite: 0.4, dateFeuillaison: "2026-04-02T09:00:00Z" });
    expect(screen.getByText(/s'étoffe depuis le 2 avril 2026/)).toBeTruthy();
  });

  it("une branche en pleine lumière dit depuis quand — et que c'est ELLE qui l'a dit", () => {
    monter({ etat: "rayonnement", intensite: 1, dateRayonnement: "2026-05-20T09:00:00Z" });
    const phrase = screen.getByText(/pleine lumière depuis le 20 mai 2026/);
    expect(phrase.textContent, "la fiche attribue le geste à l'utilisatrice, pas au produit").toMatch(
      /parce que tu l'as dit/,
    );
  });

  it("une branche qui a SAUTÉ la feuillaison n'invente pas une date qu'elle n'a pas", () => {
    // Le saut direct naissance → rayonnement est légal (elle a pu vivre la chose sans y revenir en
    // séance). `date_feuillaison` reste nulle : la fiche doit se taire là-dessus, pas broder.
    monter({ etat: "rayonnement", intensite: 0, dateRayonnement: "2026-05-20T09:00:00Z" });
    expect(screen.queryByText(/s'étoffe depuis/), "aucune feuillaison n'a eu lieu").toBeNull();
  });

  it("une branche en naissance ne raconte aucune transition", () => {
    monter({});
    expect(screen.queryByText(/s'étoffe depuis/)).toBeNull();
    expect(screen.queryByText(/pleine lumière depuis/)).toBeNull();
  });

  it("[AC5 / REVUE] AUCUNE animation d'apparition — lue dans la FEUILLE DE STYLE, pas dans jsdom", () => {
    // L'ancienne garde interrogeait `getComputedStyle` en jsdom, qui ne charge AUCUNE règle CSS d'un
    // module : `animationName` y vaut toujours "" — elle ne pouvait PAS échouer, même en ajoutant une
    // animation clinquante. Une garde qui ne peut pas rougir n'est pas une garde.
    // On lit donc la source du module CSS, en l'annonçant comme telle (DESIGN L603 : « aucune étincelle,
    // aucune particule, aucune animation festive au changement d'état ; la pleine lumière est STATIQUE »).
    // On retire les COMMENTAIRES d'abord : `.rayonnement` en porte un qui dit « aucune animation », et
    // une garde qui rougit sur le commentaire promettant l'invariant est exactement la faute de la
    // re-revue 4.6 (la liste de mots qui accusait un identifiant innocent).
    const css = readFileSync(resolve(process.cwd(), "render/arbre/arbre.module.css"), "utf-8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    for (const classe of ["ficheTransition", "rayonnement", "feuille", "ficheConfirmation"]) {
      const debut = css.indexOf(`.${classe} {`);
      expect(debut, `règle .${classe} introuvable`).toBeGreaterThan(-1);
      const regle = css.slice(debut, css.indexOf("}", debut));
      expect(regle, `.${classe} ne doit porter aucune animation`).not.toMatch(/animation|@keyframes/);
      expect(regle, `.${classe} ne doit porter aucune transition d'apparition`).not.toMatch(
        /transition[^:]*:\s*(?!none)/,
      );
    }
  });

  it("[MÉTA] cette garde CSS attraperait un mutant (elle n'est pas vraie parce qu'elle lit à côté)", () => {
    const sansCommentaires = (c: string) => c.replace(/\/\*[\s\S]*?\*\//g, "");
    // Le mutant (une vraie animation) est attrapé…
    expect(sansCommentaires(".ficheTransition {\n  animation: pop 300ms ease-out;\n}")).toMatch(/animation/);
    // …et le cas légitime (le mot dans un commentaire) ne déclenche PAS de faux positif.
    expect(sansCommentaires(".rayonnement {\n  fill: red; /* aucune animation */\n}")).not.toMatch(/animation/);
  });

  it("[REVUE] le cas ORDINAIRE — une branche qui a feuillu PUIS été déclarée n'affiche QUE l'état atteint", () => {
    // La règle « on ne montre que l'état courant » n'était montée que sur des cas dégénérés (jamais
    // feuillu, jamais déclaré). Le cas le plus fréquent — les DEUX dates présentes — n'était couvert
    // par rien : le mutant qui empile les deux phrases survivait. Or empiler « elle s'étoffe depuis le
    // 2 avril » ET « en pleine lumière depuis le 20 mai » raconte un historique que personne n'a demandé.
    monter({
      etat: "rayonnement",
      intensite: 1,
      dateFeuillaison: "2026-04-02T09:00:00Z",
      dateRayonnement: "2026-05-20T09:00:00Z",
    });
    expect(screen.getByText(/pleine lumière depuis le 20 mai 2026/)).toBeTruthy();
    expect(screen.queryByText(/s'étoffe depuis/), "l'état DÉPASSÉ ne se raconte pas").toBeNull();
  });
});

describe("[AC3] le geste — explicite, confirmé, et jamais proposé pour rien", () => {
  it("le bouton n'apparaît PAS si la branche est déjà en pleine lumière", () => {
    monter({ etat: "rayonnement", intensite: 1, dateRayonnement: "2026-05-20T09:00:00Z" }, async () => "ok");
    expect(
      screen.queryByRole("button", { name: /devenu vrai en moi/i }),
      "proposer d'atteindre ce qui est atteint invite à refaire ce qui ne se refait pas",
    ).toBeNull();
  });

  it("le bouton n'apparaît pas non plus si l'hôte ne fournit pas le geste (AD-7 : le rendu ne décide pas)", () => {
    monter({ etat: "feuillaison", intensite: 0.4 });
    expect(screen.queryByRole("button", { name: /devenu vrai en moi/i })).toBeNull();
  });

  it("un seul clic ne déclare RIEN : le geste est irréversible, il passe par une confirmation", async () => {
    const declarer = vi.fn(async (): Promise<ResultatGeste> => "ok");
    monter({ etat: "feuillaison", intensite: 0.4 }, declarer);
    await userEvent.click(screen.getByRole("button", { name: /devenu vrai en moi/i }));
    expect(declarer, "le premier clic ouvre la confirmation, il n'écrit pas").not.toHaveBeenCalled();
    expect(screen.getByText(/elle y restera/i), "et la confirmation DIT que c'est définitif").toBeTruthy();
  });

  it("« Pas encore » referme sans rien écrire", async () => {
    const declarer = vi.fn(async (): Promise<ResultatGeste> => "ok");
    monter({ etat: "feuillaison", intensite: 0.4 }, declarer);
    await userEvent.click(screen.getByRole("button", { name: /devenu vrai en moi/i }));
    await userEvent.click(screen.getByRole("button", { name: /pas encore/i }));
    expect(declarer).not.toHaveBeenCalled();
    expect(screen.queryByText(/elle y restera/i)).toBeNull();
  });

  it("confirmer appelle le geste UNE fois, avec l'id de la branche, et l'annonce au lecteur d'écran", async () => {
    const declarer = vi.fn(async (): Promise<ResultatGeste> => "ok");
    const { props } = monter({ etat: "feuillaison", intensite: 0.4 }, declarer);
    await userEvent.click(screen.getByRole("button", { name: /devenu vrai en moi/i }));
    await userEvent.click(screen.getByRole("button", { name: /oui, c'est devenu vrai/i }));
    expect(declarer).toHaveBeenCalledTimes(1);
    expect(declarer).toHaveBeenCalledWith("b1");
    expect(props.onAnnoncer).toHaveBeenCalledWith(expect.stringMatching(/pleine lumière/i));
  });

  it("une PANNE est dite honnêtement, et n'affiche pas un état que la base n'a pas écrit", async () => {
    // Sur un état IRRÉVERSIBLE, un optimisme mensonger est le pire des mensonges.
    const declarer = vi.fn(async (): Promise<ResultatGeste> => "panne");
    const { props } = monter({ etat: "feuillaison", intensite: 0.4 }, declarer);
    await userEvent.click(screen.getByRole("button", { name: /devenu vrai en moi/i }));
    await userEvent.click(screen.getByRole("button", { name: /oui, c'est devenu vrai/i }));
    expect(props.onAnnoncer).toHaveBeenCalledWith(expect.stringMatching(/pas pu/i));
    expect(props.onAnnoncer).not.toHaveBeenCalledWith(expect.stringMatching(/est en pleine lumière/i));
  });

  it("[REVUE] un REFUS ne promet PAS de réessayer — la garde tiendra encore des heures", async () => {
    // « Tu peux réessayer » dit à quelqu'un qui sort d'une crise l'invite à se heurter au même mur
    // plusieurs fois de suite. Le refus doit dire quelque chose de vrai : ce n'est pas perdu, c'est
    // juste pas maintenant. Et sans expliquer pourquoi — lui annoncer que le système l'a classée
    // n'est autorisé nulle part.
    const declarer = vi.fn(async (): Promise<ResultatGeste> => "refus");
    const { props } = monter({ etat: "feuillaison", intensite: 0.4 }, declarer);
    await userEvent.click(screen.getByRole("button", { name: /devenu vrai en moi/i }));
    await userEvent.click(screen.getByRole("button", { name: /oui, c'est devenu vrai/i }));
    const annonces = props.onAnnoncer.mock.calls.map((c) => String(c[0])).join(" | ");
    expect(annonces, "un refus ne promet pas de réessayer").not.toMatch(/réessayer/i);
    expect(annonces, "…et ne laisse pas croire que c'est perdu").toMatch(/attend|pas maintenant/i);
    expect(annonces, "…et n'annonce surtout pas un succès").not.toMatch(/est en pleine lumière/i);
    expect(annonces, "…et ne lui dit pas que le système l'a classée").not.toMatch(/détresse|épisode|crise/i);
  });
});

describe("[REVUE] le geste irréversible rend des comptes au clavier et au lecteur d'écran", () => {
  it("ouvrir la confirmation Y AMÈNE le focus et l'ANNONCE (on ne demande pas un engagement en silence)", async () => {
    const declarer = vi.fn(async (): Promise<ResultatGeste> => "ok");
    const { props } = monter({ etat: "feuillaison", intensite: 0.4 }, declarer);
    await userEvent.click(screen.getByRole("button", { name: /devenu vrai en moi/i }));
    await new Promise((r) => requestAnimationFrame(r)); // le focus est posé après la peinture
    expect(document.activeElement, "le focus ne doit pas retomber sur <body>").not.toBe(document.body);
    expect(document.activeElement?.textContent, "il va sur la QUESTION").toMatch(/elle y restera/i);
    expect(props.onAnnoncer).toHaveBeenCalledWith(expect.stringMatching(/elle y restera/i));
  });

  it("« Pas encore » ramène le focus sur le bouton qui a ouvert la question", async () => {
    const declarer = vi.fn(async (): Promise<ResultatGeste> => "ok");
    monter({ etat: "feuillaison", intensite: 0.4 }, declarer);
    await userEvent.click(screen.getByRole("button", { name: /devenu vrai en moi/i }));
    await userEvent.click(screen.getByRole("button", { name: /pas encore/i }));
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /devenu vrai en moi/i }));
  });

  it("après validation, le focus reste DANS la fiche (le bouton déclencheur a disparu)", async () => {
    const declarer = vi.fn(async (): Promise<ResultatGeste> => "ok");
    const { container } = monter({ etat: "feuillaison", intensite: 0.4 }, declarer);
    await userEvent.click(screen.getByRole("button", { name: /devenu vrai en moi/i }));
    await userEvent.click(screen.getByRole("button", { name: /oui, c'est devenu vrai/i }));
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.activeElement, "perdu sur <body> après un geste définitif").not.toBe(document.body);
    expect(container.contains(document.activeElement), "le focus reste dans la fiche").toBe(true);
  });

  it("la confirmation est un GROUPE nommé (un lecteur d'écran sait où il est)", async () => {
    monter({ etat: "feuillaison", intensite: 0.4 }, async () => "ok");
    await userEvent.click(screen.getByRole("button", { name: /devenu vrai en moi/i }));
    expect(screen.getByRole("group", { name: /elle y restera/i })).toBeTruthy();
  });

  it("un DOUBLE-CLIC rapide sur « Oui » n'écrit qu'une fois", async () => {
    // `enCours` désactive les deux boutons pendant l'appel. Sur un geste irréversible, une double
    // écriture serait sans conséquence (la RPC est idempotente) — mais la double ANNONCE, si.
    let resoudre: (v: ResultatGeste) => void = () => {};
    const declarer = vi.fn(() => new Promise<ResultatGeste>((r) => (resoudre = r)));
    monter({ etat: "feuillaison", intensite: 0.4 }, declarer);
    await userEvent.click(screen.getByRole("button", { name: /devenu vrai en moi/i }));
    const oui = screen.getByRole("button", { name: /oui, c'est devenu vrai/i });
    await userEvent.click(oui);
    expect(oui.hasAttribute("disabled"), "le bouton se verrouille pendant l'appel").toBe(true);
    resoudre("ok");
    expect(declarer).toHaveBeenCalledTimes(1);
  });
});

describe("[REVUE] pendant la fenêtre de détresse, le geste n'est même pas PROPOSÉ", () => {
  it("le bouton est absent quand `lib/scene` a suspendu les gestes", () => {
    // Avant : le geste restait offert, Sanela lisait la confirmation solennelle (« elle y restera »),
    // confirmait — et le point d'écriture refusait. Elle venait de traverser une crise, et l'app lui
    // faisait vivre un refus juste après lui avoir demandé de s'engager. La garde d'écriture était
    // correcte ; c'est l'interface qui mentait par omission.
    monter({ etat: "feuillaison", intensite: 0.4 }, async () => "ok", true);
    expect(screen.queryByRole("button", { name: /devenu vrai en moi/i })).toBeNull();
  });

  it("mais rien n'explique POURQUOI, et le reste de la fiche vit normalement", () => {
    // Masquer sans commenter : dire « tu sors d'un épisode » reviendrait à lui annoncer que le système
    // l'a classée — aucune spec ne l'autorise. Le reste (renommer, voir la conversation) doit vivre :
    // la garde vise la croissance de l'arbre, pas le droit de parole.
    const { container } = monter({ etat: "feuillaison", intensite: 0.4 }, async () => "ok", true);
    expect(container.textContent ?? "").not.toMatch(/détresse|épisode|indisponible|suspendu/i);
    expect(screen.getByRole("button", { name: /renommer/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /voir dans la conversation/i })).toBeTruthy();
  });

  it("hors fenêtre, le geste est là (contrôle positif : la garde n'est pas un mur permanent)", () => {
    monter({ etat: "feuillaison", intensite: 0.4 }, async () => "ok", false);
    expect(screen.getByRole("button", { name: /devenu vrai en moi/i })).toBeTruthy();
  });
});

describe("[REVUE / FR-028] la feuillaison se lit PAR DEGRÉS, jamais d'un bloc", () => {
  // On monte l'arbre lui-même : c'est le seul endroit où « la matière s'installe par degrés » se
  // constate. Une garde de source aurait vu un `intensite` dans le JSX et conclu à tort.
  async function arbre(intensite: number, etat: BrancheProjetee["etat"] = "feuillaison") {
    const { default: ArbreInteractif } = await import("@/render/arbre/ArbreInteractif");
    dimensionnerTout(900, 700);
    const projection = { tronc: { present: true as const }, branches: [{ ...BASE, etat, intensite }] };
    const { container } = render(
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
    const bois = container.querySelector("line")!;
    return {
      epaisseur: Number(bois.getAttribute("stroke-width")),
      feuilles: container.querySelectorAll("circle[opacity]").length,
    };
  }

  it("l'épaisseur du bois SUIT l'intensité au lieu de sauter avec l'enum", async () => {
    // Avant : `etat === "naissance" ? 2 : 3.2` — le premier retour faisait passer le trait de 2 à
    // 3,2 px d'un coup. FR-028 : « progressive, jamais binaire ; le trait s'épaissit AU FIL des retours ».
    const nue = await arbre(0, "naissance");
    const premier = await arbre(0.2);
    const moitie = await arbre(0.6);
    const pleine = await arbre(1);
    expect(nue.epaisseur, "une branche nue reste fine").toBeCloseTo(2, 5);
    expect(premier.epaisseur).toBeGreaterThan(nue.epaisseur);
    expect(moitie.epaisseur).toBeGreaterThan(premier.epaisseur);
    expect(pleine.epaisseur).toBeGreaterThan(moitie.epaisseur);
    expect(premier.epaisseur, "le premier retour n'atteint PAS déjà l'épaisseur maximale").toBeLessThan(
      pleine.epaisseur * 0.75,
    );
  });

  it("le premier retour déplie QUELQUES feuilles, pas le feuillage entier", async () => {
    const premier = await arbre(0.2);
    const pleine = await arbre(1);
    expect(premier.feuilles).toBeGreaterThan(0);
    expect(premier.feuilles, "cinq feuilles d'un coup, c'est un basculement, pas une croissance").toBeLessThanOrEqual(
      Math.ceil(pleine.feuilles / 3),
    );
    expect(pleine.feuilles).toBeGreaterThan(premier.feuilles);
  });

  it("la densité augmente à CHAQUE degré (aucun palier plat entre deux retours)", async () => {
    const mesures = [];
    for (const i of [0.2, 0.4, 0.6, 0.8, 1]) mesures.push(await arbre(i));
    for (let k = 1; k < mesures.length; k++) {
      expect(mesures[k].feuilles, `degré ${k} : le feuillage doit s'être étoffé`).toBeGreaterThan(
        mesures[k - 1].feuilles,
      );
    }
  });
});

describe("[FR-031] aucun chiffre de progression n'atteint l'écran", () => {
  it("une fiche en feuillaison n'affiche ni pourcentage, ni compteur, ni « x sur y »", () => {
    const { container } = monter({
      etat: "feuillaison",
      intensite: 0.6,
      dateFeuillaison: "2026-04-02T09:00:00Z",
    });
    const texte = container.textContent ?? "";
    // La DATE porte légitimement des chiffres : on vise la progression chiffrée, pas les dates.
    const sansDates = texte.replace(/\d{1,2}\s+\p{L}+\s+\d{4}/gu, "");
    expect(sansDates, "l'intensité ne doit jamais se lire en chiffres").not.toMatch(/\d/);
  });
});
