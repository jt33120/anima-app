import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ArbreInteractif from "@/render/arbre/ArbreInteractif";
import { nomRecevable } from "@/render/arbre/ChampRenommage";
import {
  ACTION_RENOMMER,
  ACTION_VALIDER_RENOMMAGE,
  ACTION_ANNULER_RENOMMAGE,
  SUCCES_RENOMMAGE,
  CHAMP_RENOMMER_LABEL,
  NOM_LONGUEUR_MAX,
} from "@/render/arbre/copie-arbre";
import type { BrancheProjetee, ProjectionScene } from "@/lib/scene";
import { dimensionnerTout } from "./_outils";

/**
 * Story 4.6 — LE RENOMMAGE, monté pour de vrai. Trois défauts trouvés par la RE-REVUE, tous invisibles
 * à la lecture de source :
 *  • le succès était MUET — `onTermine()` démontait le champ dans le MÊME commit que `setAnnonce(...)`,
 *    donc la région `aria-live` n'a jamais porté le texte. Le correctif d'accessibilité ne fonctionnait
 *    pas, et le focus retombait sur <body>. L'annonce vit désormais dans une région PERSISTANTE.
 *  • en VUE LISTE, un renommage ouvert par erreur ne pouvait plus être refermé (ni Échap, ni Annuler :
 *    la fiche — qui portait le × et l'Échap — n'existe pas dans cette vue).
 *  • la base bornait le nom à 300 caractères sans aucun miroir applicatif : le bouton restait actif et
 *    la RPC levait un échec incompréhensible (asymétrie R1-bis, en sens inverse).
 */

const branche = (id: string): BrancheProjetee => ({
  id,
  etat: "naissance",
  intensite: 0,
  extraitSourceId: `extrait-${id}`,
  nom: `nom de ${id}`,
  dateNaissance: "2026-03-11T10:00:00.000Z",
});

const scene = (n = 2): ProjectionScene => ({
  tronc: { present: true },
  branches: Array.from({ length: n }, (_, i) => branche(`b${i}`)),
});

function monter(onRenommer = vi.fn(async () => true)) {
  dimensionnerTout(800, 600);
  const vue = render(
    <ArbreInteractif
      projection={scene()}
      camera={{ pan: { x: 0, y: 0 }, zoom: 1 }}
      brancheSelectionnee={null}
      onCadrer={vi.fn()}
      onOuvrirFiche={vi.fn()}
      onFermerFiche={vi.fn()}
      onVoirDansConversation={vi.fn()}
      onRenommer={onRenommer}
    />,
  );
  return { ...vue, onRenommer };
}

/** Ouvre la VUE LISTE (le doublage non-spatial, AC8) puis le champ de renommage de la 1re branche. */
async function ouvrirRenommageEnListe(u: ReturnType<typeof userEvent.setup>) {
  await u.click(screen.getByRole("button", { name: /vue liste/i }));
  const boutons = screen.getAllByRole("button", { name: ACTION_RENOMMER });
  await u.click(boutons[0]);
  return screen.getByLabelText(CHAMP_RENOMMER_LABEL);
}

describe("[re-revue] le renommage réussi est ANNONCÉ et ne perd pas le focus", () => {
  it("le succès remplit une région aria-live qui SURVIT à la fermeture du champ", async () => {
    const u = userEvent.setup();
    monter();
    const champ = await ouvrirRenommageEnListe(u);

    await u.type(champ, "ce que j'ai vu");
    await u.click(screen.getByRole("button", { name: ACTION_VALIDER_RENOMMAGE }));

    // Le champ se referme…
    await waitFor(() => expect(screen.queryByLabelText(CHAMP_RENOMMER_LABEL)).toBeNull());
    // …et l'annonce est BIEN dans le DOM, dans une région live encore montée.
    await waitFor(() => {
      const live = [...document.querySelectorAll("[aria-live]")].map((e) => e.textContent ?? "");
      expect(live.join(" "), "le renommage réussi est resté MUET").toContain(SUCCES_RENOMMAGE);
    });
  });

  it("le focus ne retombe pas sur <body> après un renommage réussi", async () => {
    const u = userEvent.setup();
    monter();
    const champ = await ouvrirRenommageEnListe(u);
    await u.type(champ, "un nom");
    await u.click(screen.getByRole("button", { name: ACTION_VALIDER_RENOMMAGE }));

    await waitFor(() => expect(screen.queryByLabelText(CHAMP_RENOMMER_LABEL)).toBeNull());
    await waitFor(() => {
      expect(document.activeElement, "le focus est perdu : la navigation clavier repart de zéro").not.toBe(
        document.body,
      );
    });
  });
});

describe("[re-revue] le renommage est ANNULABLE, y compris en vue liste", () => {
  it("Échap referme le champ sans renommer", async () => {
    const u = userEvent.setup();
    const { onRenommer } = monter();
    const champ = await ouvrirRenommageEnListe(u);

    await u.type(champ, "je change d'avis");
    await u.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByLabelText(CHAMP_RENOMMER_LABEL)).toBeNull());
    expect(onRenommer, "Échap ne doit rien écrire").not.toHaveBeenCalled();
  });

  it("un bouton « Annuler » referme le champ sans renommer", async () => {
    const u = userEvent.setup();
    const { onRenommer } = monter();
    await ouvrirRenommageEnListe(u);

    await u.click(screen.getByRole("button", { name: ACTION_ANNULER_RENOMMAGE }));

    await waitFor(() => expect(screen.queryByLabelText(CHAMP_RENOMMER_LABEL)).toBeNull());
    expect(onRenommer).not.toHaveBeenCalled();
  });
});

describe("[re-revue / R1-bis] la borne de longueur de l'app reflète celle de la base", () => {
  it("le champ borne la saisie à la MÊME longueur que le CHECK SQL", async () => {
    const u = userEvent.setup();
    monter();
    const champ = (await ouvrirRenommageEnListe(u)) as HTMLInputElement;
    expect(champ.maxLength, "sans borne, la RPC lève un échec incompréhensible").toBe(NOM_LONGUEUR_MAX);
  });

  it("la VALIDATION refuse un nom hors borne, indépendamment de `maxLength`", () => {
    // `maxLength` est la bretelle : le navigateur tronque la frappe ET le collage. La CEINTURE est la
    // validation, seule à tenir si la valeur arrive autrement (remplissage automatique, extension,
    // affectation programmatique). Les deux doivent exister — c'est exactement la leçon R1-bis
    // transposée au client : une garde présente à un seul bout n'est pas une garde.
    expect(nomRecevable("x".repeat(NOM_LONGUEUR_MAX))).toBe(true);
    expect(nomRecevable("x".repeat(NOM_LONGUEUR_MAX + 1)), "nom hors borne accepté par l'app").toBe(false);
    expect(nomRecevable("   "), "un nom d'espaces n'est pas un nom").toBe(false);
  });

  it("deux boutons du même formulaire ne portent pas le MÊME nom accessible", async () => {
    const u = userEvent.setup();
    monter();
    await ouvrirRenommageEnListe(u);
    const noms = screen.getAllByRole("button").map((b) => b.textContent?.trim() || b.getAttribute("aria-label"));
    const doublons = noms.filter((n, i) => n && noms.indexOf(n) !== i && n === ACTION_VALIDER_RENOMMAGE);
    expect(doublons, "« Renommer » désignait à la fois l'ouverture et la validation").toHaveLength(0);
  });
});
