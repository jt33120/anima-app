import { describe, it, expect } from "vitest";
import {
  reconcilierProjection,
  adopterProjection,
  type ProjectionScene,
  type BrancheProjetee,
} from "@/lib/scene/projection";

/**
 * Story 4.6 (T2) — la défense anti-régression AU RENDU (AC2 [DUR défensif]), fonction PURE.
 * Si une projection ultérieure renvoie pour une branche un état/intensité INFÉRIEUR à l'état max
 * déjà connu, on CONSERVE le supérieur et on liste l'incident (id + champ seuls — jamais le nom art. 9).
 * La monotonie d'ÉCRITURE (SQL) est la Story 4.7 ; ceci est le filet client, testable sans navigateur.
 */

const br = (id: string, etat: BrancheProjetee["etat"], intensite: number): BrancheProjetee => ({
  id,
  etat,
  intensite,
  extraitSourceId: `src-${id}`,
  nom: "un nom art. 9 secret",
});

const scene = (branches: BrancheProjetee[]): ProjectionScene => ({ tronc: { present: true }, branches });

describe("reconcilierProjection — l'arbre ne régresse jamais au rendu (AC2)", () => {
  it("un état serveur INFÉRIEUR au max connu est remonté au supérieur + un incident est listé", () => {
    const precedente = scene([br("a", "feuillaison", 0.6)]);
    const nouvelle = scene([br("a", "naissance", 0.6)]); // régression d'état
    const { projection, incidents } = reconcilierProjection(precedente, nouvelle);
    expect(projection.branches[0].etat).toBe("feuillaison"); // conservé
    expect(incidents).toEqual([{ id: "a", champ: "etat" }]);
  });

  it("une intensité serveur inférieure est remontée + incident (feuillaison ne recule pas)", () => {
    const precedente = scene([br("a", "feuillaison", 0.8)]);
    const nouvelle = scene([br("a", "feuillaison", 0.3)]);
    const { projection, incidents } = reconcilierProjection(precedente, nouvelle);
    expect(projection.branches[0].intensite).toBe(0.8);
    expect(incidents).toEqual([{ id: "a", champ: "intensite" }]);
  });

  it("une progression normale (état supérieur) passe SANS incident", () => {
    const precedente = scene([br("a", "naissance", 0)]);
    const nouvelle = scene([br("a", "feuillaison", 0.4)]);
    const { projection, incidents } = reconcilierProjection(precedente, nouvelle);
    expect(projection.branches[0].etat).toBe("feuillaison");
    expect(incidents).toHaveLength(0);
  });

  it("une nouvelle branche (inconnue de la précédente) passe telle quelle, sans incident", () => {
    const { projection, incidents } = reconcilierProjection(scene([]), scene([br("neuve", "naissance", 0)]));
    expect(projection.branches).toHaveLength(1);
    expect(incidents).toHaveLength(0);
  });

  it("les incidents ne portent JAMAIS le nom art. 9 (NFR-022) — id + champ seuls", () => {
    const { incidents } = reconcilierProjection(scene([br("a", "fruit", 1)]), scene([br("a", "naissance", 0)]));
    const dump = JSON.stringify(incidents);
    expect(dump).not.toContain("secret");
    expect(Object.keys(incidents[0]).sort()).toEqual(["champ", "id"]);
  });

  it("[revue 4.6, HAUTE] la DISPARITION d'une branche connue est un incident (l'arbre entier s'effaçait en silence)", () => {
    const precedente = scene([br("a", "feuillaison", 0.5), br("b", "naissance", 0)]);
    const nouvelle = scene([br("a", "feuillaison", 0.5)]); // « b » n'est plus servie
    const { incidents } = reconcilierProjection(precedente, nouvelle);
    expect(incidents).toContainEqual({ id: "b", champ: "disparition" });
  });

  it("[revue 4.6, HAUTE] une lecture INDISPONIBLE n'est PAS lue comme un effacement (aucun incident, rien n'est conclu)", () => {
    const precedente = scene([br("a", "fruit", 1), br("b", "feuillaison", 0.5)]);
    const panne: ProjectionScene = { tronc: { present: true }, branches: [], indisponible: true };
    const { projection, incidents } = reconcilierProjection(precedente, panne);
    expect(incidents, "une panne n'est pas une régression : c'est une absence d'information").toHaveLength(0);
    expect(projection.indisponible, "le marqueur est propagé pour que le rendu ne mente pas").toBe(true);
  });

  it("[revue 4.6] une intensité NON FINIE (NaN) ne traverse plus la garde : incident + repère conservé", () => {
    const precedente = scene([br("a", "feuillaison", 0.7)]);
    const nouvelle = scene([br("a", "feuillaison", Number.NaN)]);
    const { projection, incidents } = reconcilierProjection(precedente, nouvelle);
    expect(Number.isFinite(projection.branches[0].intensite), "aucun NaN ne sort du réconciliateur").toBe(true);
    expect(projection.branches[0].intensite).toBe(0.7);
    expect(incidents).toContainEqual({ id: "a", champ: "intensite" });
  });

  it("[revue 4.6] une intensité HORS BORNES est ramenée dans [0,1] (le rendu ne peut plus geler)", () => {
    const { projection } = reconcilierProjection(scene([]), scene([br("a", "feuillaison", 1e9)]));
    expect(projection.branches[0].intensite).toBe(1);
    const negatif = reconcilierProjection(scene([]), scene([br("b", "feuillaison", -5)]));
    expect(negatif.projection.branches[0].intensite).toBe(0);
  });

  it("est PURE : ne mute ni la projection précédente ni la nouvelle", () => {
    const precedente = scene([br("a", "fruit", 1)]);
    const nouvelle = scene([br("a", "naissance", 0)]);
    const gelPrec = JSON.stringify(precedente);
    const gelNouv = JSON.stringify(nouvelle);
    reconcilierProjection(precedente, nouvelle);
    expect(JSON.stringify(precedente)).toBe(gelPrec);
    expect(JSON.stringify(nouvelle)).toBe(gelNouv);
  });
});

describe("[HAUTE / re-revue] adopterProjection — une panne n'efface pas un arbre déjà affiché", () => {
  const br = (id: string) => ({ id, etat: "naissance" as const, intensite: 0, extraitSourceId: `s-${id}` });
  const AFFICHE = { tronc: { present: true as const }, branches: [br("a"), br("b")] };
  const PANNE = { tronc: { present: true as const }, branches: [], indisponible: true as const };

  it("une lecture INDISPONIBLE est IGNORÉE quand des branches sont déjà à l'écran", () => {
    // Le rafraîchissement serveur part à chaque entrée dans la région arbre. Un hoquet réseau y
    // remplaçait des branches RÉELLES par « je n'arrive pas à afficher ton arbre » : l'arbre
    // disparaissait sous ses yeux, ce qui est la régression que FR-029 interdit.
    expect(adopterProjection(AFFICHE, PANNE)).toBe(AFFICHE);
  });

  it("mais elle est ADOPTÉE quand on n'a rien de vrai à montrer (sinon on mentirait par omission)", () => {
    const vide = { tronc: { present: true as const }, branches: [] };
    expect(adopterProjection(vide, PANNE)).toBe(PANNE);
    expect(adopterProjection(PANNE, PANNE)).toBe(PANNE);
  });

  it("une lecture RÉUSSIE est toujours adoptée, même si elle a moins de branches", () => {
    // L'anti-régression par branche est le travail de `reconcilierProjection` ; ici on ne fait que
    // choisir la source. Confondre les deux ferait de cette fonction un cache qui ne se vide jamais.
    const moins = { tronc: { present: true as const }, branches: [br("a")] };
    expect(adopterProjection(AFFICHE, moins)).toBe(moins);
  });
});
