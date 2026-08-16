import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, cleanup } from "@testing-library/react";
import Fil from "@/render/conversation/Fil";
import PiedHalte from "@/render/PiedHalte";
import { MENTION_IA, URL_AIDE, URL_TRANSPARENCE } from "@/lib/domain/pied-halte";
import type { Tour } from "@/render/conversation/types";

/**
 * attente-et-filet.test.tsx — LES TROIS CONSTATS DE FINITION (Story 6.9 : QA T7, T13, T26).
 *
 * ⚠️ CE QUE CE FICHIER NE PEUT PAS PROUVER, ET IL FAUT LE DIRE ICI PLUTÔT QUE DE LAISSER CROIRE.
 *
 * **jsdom n'a pas de moteur de mise en page.** Toutes les hauteurs y valent zéro, aucun `padding`
 * n'est calculé, `scrollHeight` vaut `clientHeight`. Le constat T26 — « le fil ne fait que 307 px
 * dans une fenêtre de 742 » — est donc INVÉRIFIABLE ICI, et le restera : c'est une mesure de
 * navigateur réel, elle ne se re-mesure que dans un navigateur réel.
 *
 * Ce qu'on garde à la place est le MÉCANISME : que le filet soit amené dans le champ à son
 * insertion, quelle que soit la hauteur disponible. C'est plus faible que la mesure, et c'est dit.
 */

afterEach(cleanup);

const tourUtilisatrice = (id: string): Tour => ({ id, role: "utilisatrice", texte: "…" });
const tourRessource = (id: string): Tour => ({
  id,
  role: "ressource",
  // Le tour d'Anam auquel le bloc est rattaché (2.6/R2) — sans objet ici, mais le type l'exige, et
  // c'est bien : un bloc de ressources orphelin ne devrait jamais pouvoir se construire.
  ancreId: `anam-${id}`,
  ressources: [
    { tel: "3114", numero: "3114", service: "Numéro national de prévention du suicide", aria: "3 1 1 4", desc: "Jour et nuit." },
  ],
  verifieLe: "1er août 2026",
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// T13 — le signe de vie, là où elle regarde
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.9/T13] Anam prépare : un signe EN BAS DU FIL", () => {
  it("[LE CŒUR] pendant l'attente, un signe paraît — et il n'y est pas sinon", () => {
    const { container, rerender } = render(<Fil tours={[tourUtilisatrice("u1")]} annonce="" />);
    expect(container.querySelector("svg"), "un signe d'attente hors attente").toBeNull();

    rerender(<Fil tours={[tourUtilisatrice("u1")]} annonce="" prepare />);
    expect(container.querySelector("svg"), "aucun signe pendant l'attente").not.toBeNull();
  });

  it("[LE CŒUR] il paraît APRÈS le dernier tour — là où la réponse va naître", () => {
    // Placé en tête, il serait un décor ; placé en fin, il occupe la place de ce qu'on attend.
    const { container } = render(
      <Fil tours={[tourUtilisatrice("u1"), tourUtilisatrice("u2")]} annonce="" prepare />,
    );
    const enfants = [...(container.querySelector("div")?.children ?? [])];
    const iSigne = enfants.findIndex((e) => e.querySelector("svg"));
    const iDernierTour = enfants.map((e) => e.textContent).lastIndexOf("…");
    expect(iSigne).toBeGreaterThan(iDernierTour);
  });

  it("[LE CŒUR] AUCUNE animation cyclique — la décision de la 2.2 n'est pas rouverte", () => {
    // « Jamais trois points qui rebondissent ». Un `@keyframes` dans la feuille de la conversation
    // à l'endroit exact où une réponse intime va paraître dirait « la machine calcule ».
    const css = readFileSync(
      resolve(__dirname, "../../render/conversation/conversation.module.css"),
      "utf-8",
    );
    const bloc = css.slice(css.indexOf(".attente"), css.indexOf(".attente") + 600);
    expect(bloc).not.toMatch(/animation|@keyframes/);
  });

  it("il est DÉCORATIF : il ne parle pas aux lecteurs d'écran", () => {
    // L'annonce passe par la région `aria-live` UNIQUE du fil (voir `Conversation.tsx`). Une
    // seconde région vivante se doublerait avec elle sur NVDA.
    const { container } = render(<Fil tours={[]} annonce="" prepare />);
    const signe = container.querySelector("svg")!;
    expect(signe.closest("[aria-hidden]")).not.toBeNull();
  });

  it("[ANTI-RÉGRESSION] la région d'annonce reste UNIQUE", () => {
    const { container } = render(<Fil tours={[tourRessource("r1")]} annonce="fini" prepare />);
    // `BlocRessources` porte son propre `aria-live` depuis la 2.6 ; celui du fil est le second et
    // le dernier. Un troisième ferait exactement ce que l'en-tête de `Fil.tsx` interdit.
    expect(container.querySelectorAll("[aria-live]").length).toBeLessThanOrEqual(2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// T26 — le filet vient à elle
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.9/T26] Le bloc de ressources est AMENÉ dans le champ", () => {
  it("[LE CŒUR] à son insertion, le filet est amené dans le champ", () => {
    // ⚠️ LA SEULE EXCEPTION au suivi du bas NON CAPTIF (2.2/AC3). Si elle a remonté le fil, on ne
    // la ramène pas — sauf ici : AD-9/AD-15 veulent que le filet ATTEIGNE.
    const amener = vi.fn();
    Element.prototype.scrollIntoView = amener;
    const { rerender } = render(<Fil tours={[tourUtilisatrice("u1")]} annonce="" />);
    expect(amener, "quelque chose a défilé sans qu'un filet paraisse").not.toHaveBeenCalled();

    rerender(<Fil tours={[tourUtilisatrice("u1"), tourRessource("r1")]} annonce="" />);
    expect(amener).toHaveBeenCalledTimes(1);
    // `nearest` : on l'amène dans le champ SANS la déplacer plus que nécessaire.
    expect(amener).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("[LE CŒUR] il n'est PAS ramené à chaque nouveau tour — on ne la rend pas captive", () => {
    // Sans ce contrôle, la « correction » deviendrait un défilement forcé à chaque message : le
    // suivi captif que la 2.2 a refusé, réintroduit par la porte du filet.
    const amener = vi.fn();
    Element.prototype.scrollIntoView = amener;
    const { rerender } = render(<Fil tours={[tourRessource("r1")]} annonce="" />);
    expect(amener).toHaveBeenCalledTimes(1);
    rerender(<Fil tours={[tourRessource("r1"), tourUtilisatrice("u2")]} annonce="" />);
    rerender(<Fil tours={[tourRessource("r1"), tourUtilisatrice("u2"), tourUtilisatrice("u3")]} annonce="" />);
    expect(amener, "le fil est devenu captif").toHaveBeenCalledTimes(1);
  });

  it("un SECOND épisode ramène de nouveau — c'est un autre filet", () => {
    const amener = vi.fn();
    Element.prototype.scrollIntoView = amener;
    const { rerender } = render(<Fil tours={[tourRessource("r1")]} annonce="" />);
    rerender(<Fil tours={[tourRessource("r1"), tourUtilisatrice("u2"), tourRessource("r2")]} annonce="" />);
    expect(amener).toHaveBeenCalledTimes(2);
  });

  it("[GARDE DE MISE EN PAGE] la région de conversation ne paie plus l'air qu'elle ne défile pas", () => {
    // La hauteur exacte est INVÉRIFIABLE en jsdom (voir l'en-tête). On garde la RAISON : la région
    // de conversation ne défile pas, donc elle n'a pas besoin de la réserve anti-débordement de
    // `.region`. Qui la remettrait reprendrait 64 px au fil, au pire endroit.
    const css = readFileSync(resolve(__dirname, "../../render/monde.module.css"), "utf-8");
    const bloc = css.slice(css.indexOf(".regionConversation"), css.indexOf(".titreConversation"));
    expect(bloc).toMatch(/overflow:\s*hidden/);
    expect(bloc).toMatch(/padding-top:\s*var\(--cible-tactile\)/);
    expect(bloc).toMatch(/padding-bottom:\s*var\(--cible-tactile\)/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// T7 — le pied de halte, monté pour de vrai
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.9/T7] Le pied de halte, monté", () => {
  const monter = (mentionIA: boolean) =>
    render(
      <PiedHalte
        mentionIA={mentionIA}
        texteMention={MENTION_IA}
        urlTransparence={URL_TRANSPARENCE}
        urlAide={URL_AIDE}
      />,
    );

  it("[LE CŒUR] la porte de secours est là, mention ou pas", () => {
    monter(false);
    const aide = screen.getByRole("link", { name: "Aide" }) as HTMLAnchorElement;
    expect(aide.getAttribute("href")).toBe(URL_AIDE);
    cleanup();
    monter(true);
    expect(screen.getByRole("link", { name: "Aide" })).toBeTruthy();
  });

  it("la mention IA paraît quand elle est due, et pointe vers la transparence", () => {
    monter(true);
    const lien = screen.getByRole("link", { name: MENTION_IA }) as HTMLAnchorElement;
    expect(lien.getAttribute("href")).toBe(URL_TRANSPARENCE);
  });

  it("[LE CONTRE-TEST] elle ne paraît pas quand elle n'est pas due", () => {
    monter(false);
    expect(screen.queryByRole("link", { name: MENTION_IA })).toBeNull();
  });

  it("la porte de secours est le DERNIER arrêt de tabulation — elle ne cède sa place à rien", () => {
    monter(true);
    const liens = screen.getAllByRole("link");
    expect(liens[liens.length - 1].textContent).toBe("Aide");
  });
});
