import { describe, it, expect } from "vitest";
import { toursApresRejeu, blocRessourcesDejaPresent } from "@/render/conversation/rejeu";
import type { Tour } from "@/render/conversation/types";

/**
 * rejeu-ne-retire-pas-le-filet.test.ts — « RÉESSAYER » N'EFFACE PLUS LE 3114.
 *
 * ══ LE DÉFAUT, TROUVÉ PAR LA REVUE DES EPICS 1 À 4 (2026-08-18) ═════════════════════════════════
 *
 * Le bloc de numéros d'urgence était ancré au tour d'Anam par `ancreId`, et la purge de « Réessayer »
 * retirait TOUT ce qui portait cette ancre. Le geste que l'écran propose à quelqu'un dont le tour
 * vient d'échouer retirait donc son 3114.
 *
 * Et il ne revenait pas. La seconde tentative retombe sur le même fournisseur dégradé, le repli rend
 * un niveau bas, et aucun bloc n'est réémis sous le niveau 2. Une femme classée « idéation active »
 * se retrouvait sans un seul numéro à l'écran — de façon DÉTERMINISTE dès que la panne durait plus
 * d'un tour, c'est-à-dire précisément quand elle réessaie.
 *
 * ══ POURQUOI CE FICHIER EXISTE PLUTÔT QU'UNE LECTURE DE SOURCE ══════════════════════════════════
 *
 * La règle vivait dans un `setTours` au milieu de `Conversation.tsx` : les gardes ne pouvaient que
 * LIRE LE FICHIER (« le filtre cite-t-il le mot “carte” ? »). Un test qui lit un source ne voit pas
 * ce qu'un fil devient. La règle est donc sortie dans `rejeu.ts`, et ce fichier l'exerce sur de vrais
 * tours — les mutants ci-dessous meurent sur ce qu'ELLE verrait, pas sur une chaîne de caractères.
 */

const ANCRE = "anam-1";

const filet: readonly { readonly numero: string; readonly tel: string; readonly aria: string; readonly service: string; readonly desc: string }[] =
  [
    { numero: "3114", tel: "3114", aria: "3 1 1 4", service: "Prévention du suicide", desc: "…" },
    { numero: "15", tel: "15", aria: "1 5", service: "SAMU", desc: "…" },
  ];

const tourAnam: Tour = { id: ANCRE, role: "anam", texte: "…", etat: "echec" };
const tourRessource: Tour = { id: "res-1", role: "ressource", ancreId: ANCRE, ressources: filet, verifieLe: "2026-08-18" };
const tourBilan: Tour = { id: "bil-1", role: "bilan", ancreId: ANCRE, titre: "t", points: ["p"] };
const tourPaywall: Tour = { id: "pay-1", role: "paywall", ancreId: ANCRE };
const tourCarte: Tour = { id: "car-1", role: "carte", cle: "le-miroir", description: null };

describe("[revue 1-4] « Réessayer » et le filet de détresse", () => {
  it("⚠️ le bloc de ressources SURVIT au rejeu du tour auquel il est ancré", () => {
    // LE MUTANT QUI COMPTE : rajouter `t.role === "ressource"` dans le filtre — la forme exacte qui
    // vivait ici avant la revue. Il meurt sur cette ligne, et sur rien d'autre.
    const apres = toursApresRejeu([tourAnam, tourRessource], ANCRE);
    expect(apres.map((t) => t.id), "le 3114 a quitté l'écran par le geste qu'on lui propose").toEqual([
      "res-1",
    ]);
  });

  it("le tour d'Anam en échec part, lui — sinon le rejeu doublerait la réponse", () => {
    expect(toursApresRejeu([tourAnam, tourRessource], ANCRE).some((t) => t.id === ANCRE)).toBe(false);
  });

  it("le bilan et le paywall ancrés partent : un rejeu les réémettrait en double (2.6 R2 / 3.2)", () => {
    const apres = toursApresRejeu([tourAnam, tourBilan, tourPaywall], ANCRE);
    expect(apres, "un bilan orphelin + son double au rejeu").toEqual([]);
  });

  it("mais un bilan ancré à un AUTRE tour reste : on ne purge que CE tour-ci (revue 2.2)", () => {
    const ailleurs: Tour = { ...tourBilan, id: "bil-2", ancreId: "anam-0" };
    expect(toursApresRejeu([tourAnam, ailleurs], ANCRE).map((t) => t.id)).toEqual(["bil-2"]);
  });

  it("la carte de lecture reste : elle n'a pas d'ancre, et le rituel ne se rejoue pas (3.2 AC5)", () => {
    expect(toursApresRejeu([tourAnam, tourCarte], ANCRE).map((t) => t.id)).toEqual(["car-1"]);
  });
});

describe("[revue 1-4] le doublon se refuse à l'INSERTION, jamais par une suppression", () => {
  it("un second bloc portant les MÊMES numéros sur le MÊME tour est reconnu comme déjà là", () => {
    expect(blocRessourcesDejaPresent([tourAnam, tourRessource], ANCRE, filet)).toBe(true);
  });

  it("⚠️ mais un bloc AUTRE (numéros différents) passe — sinon un niveau qui monte n'ajouterait rien", () => {
    // Le niveau 3 ajoute des numéros que le niveau 2 ne portait pas. Une garde qui dédoublonnerait
    // sur la seule ancre les confondrait, et le filet le plus complet n'arriverait jamais.
    expect(blocRessourcesDejaPresent([tourAnam, tourRessource], ANCRE, [{ numero: "112" }])).toBe(false);
  });

  it("et le même filet sur un AUTRE tour n'est pas un doublon : chaque tour porte le sien", () => {
    expect(blocRessourcesDejaPresent([tourAnam, tourRessource], "anam-2", filet)).toBe(false);
  });

  it("un fil vide n'a rien à refuser", () => {
    expect(blocRessourcesDejaPresent([], ANCRE, filet)).toBe(false);
  });
});
