import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import Reglages, { type ProprietesReglages } from "@/render/reglages/Reglages";
import {
  ACTIVER,
  DESACTIVER,
  DESCRIPTION_SOCLE,
  ECHEC,
  ETAT_ACTIF,
  ETAT_INACTIF,
  INDISPONIBLE,
  LABEL_HEURE,
  PAS_ENCORE_ACTIF,
  PERMISSION_REFUSEE,
  PERMISSION_SANS_REPONSE,
  SECTION_SOCLE,
} from "@/lib/domain/copie-reglages";

/**
 * Story 6.2 (AC4) — L'ÉCRAN DE RÉGLAGES.
 *
 * Ce qu'on éprouve ici tient en une phrase : **la permission ne se demande QUE sur un clic**, et
 * chacun des trois refus possibles se dit sans jamais devenir une panne.
 */

const CLE = "B".repeat(87);

function proprietes(sur: Partial<ProprietesReglages> = {}): ProprietesReglages {
  return {
    // ⚠️ La copie RÉELLE, jamais des libellés d'essai : ce fichier vérifie aussi que le bon texte
    // apparaît au bon état, et un « bouton A » inventé ici rendrait ces assertions vides.
    copie: {
      section: SECTION_SOCLE,
      description: DESCRIPTION_SOCLE,
      activer: ACTIVER,
      desactiver: DESACTIVER,
      labelHeure: LABEL_HEURE,
      etatActif: ETAT_ACTIF,
      etatInactif: ETAT_INACTIF,
      permissionRefusee: PERMISSION_REFUSEE,
      permissionSansReponse: PERMISSION_SANS_REPONSE,
      indisponible: INDISPONIBLE,
      echec: ECHEC,
      pasEncoreActif: PAS_ENCORE_ACTIF,
    },
    clePublique: CLE,
    abonneIci: false,
    heure: 8,
    enService: true,
    abonner: vi.fn(async () => ({ statut: "ok" })),
    desabonner: vi.fn(async () => ({ statut: "ok" })),
    choisirHeure: vi.fn(async () => ({ statut: "ok" })),
    ...sur,
  };
}

/** Un navigateur qui sait pousser : permission accordée, service worker et abonnement doublés. */
function navigateurCapable(o: { permission?: NotificationPermission } = {}) {
  const desabonner = vi.fn(async () => true);
  const abonnement = {
    endpoint: "https://web.push.apple.com/anam-essai",
    toJSON: () => ({
      endpoint: "https://web.push.apple.com/anam-essai",
      keys: { p256dh: CLE, auth: "A".repeat(22) },
    }),
    unsubscribe: desabonner,
  };
  const demande = vi.fn(async () => o.permission ?? ("granted" as NotificationPermission));
  vi.stubGlobal("Notification", { requestPermission: demande, permission: "default" });
  vi.stubGlobal("PushManager", class {});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: vi.fn(async () => ({
        pushManager: { subscribe: vi.fn(async () => abonnement), getSubscription: async () => abonnement },
      })),
      ready: Promise.resolve({}),
      getRegistration: async () => ({
        pushManager: { subscribe: vi.fn(async () => abonnement), getSubscription: async () => abonnement },
      }),
    },
  });
  return { demande, desabonner };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("[6.2/AC4] la permission ne se demande QUE sur un clic", () => {
  it("[LE CŒUR] rien n'est demandé au MONTAGE", async () => {
    // ⚠️ Mutation-cible : appeler `Notification.requestPermission()` dans un `useEffect`. C'est la
    // forme la plus courante et la plus interdite : une boîte de dialogue système au chargement, que
    // l'AC4 refuse (« sans bannière insistante ») et que les navigateurs pénalisent. Le pire est que
    // le refus qui s'ensuit est DÉFINITIF — on aurait brûlé la permission sans rien avoir expliqué.
    const { demande } = navigateurCapable();
    render(<Reglages {...proprietes()} />);
    await waitFor(() => expect(screen.getByRole("button")).toBeDefined());
    expect(demande, "la permission a été demandée sans qu'elle ait cliqué").not.toHaveBeenCalled();
  });

  it("un clic sur le bouton demande la permission et enregistre l'appareil", async () => {
    const { demande } = navigateurCapable();
    const p = proprietes();
    render(<Reglages {...p} />);
    screen.getByRole("button", { name: ACTIVER }).click();
    await waitFor(() => expect(demande).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(p.abonner).toHaveBeenCalledWith(
        "https://web.push.apple.com/anam-essai",
        CLE,
        "A".repeat(22),
      ),
    );
    await waitFor(() => expect(screen.getByTestId("etat-abonnement").textContent).toBe(ETAT_ACTIF));
  });

  it("[LE CŒUR] un refus se DIT, et ne se represente pas", async () => {
    const { demande } = navigateurCapable({ permission: "denied" });
    const p = proprietes();
    render(<Reglages {...p} />);
    screen.getByRole("button", { name: ACTIVER }).click();
    await waitFor(() => expect(screen.getByTestId("message-reglages").textContent).toBe(PERMISSION_REFUSEE));
    expect(p.abonner, "on a enregistré un appareil qui n'a pas la permission").not.toHaveBeenCalled();
    expect(demande).toHaveBeenCalledTimes(1);
  });

  it("[LE CŒUR] une question SANS RÉPONSE n'est pas un refus — et elle peut être reposée", async () => {
    // ⚠️ Mutation-cible : replier `default` sur `refuse` (c'est-à-dire le code d'avant, où la seule
    // condition était `permission !== "granted"`). Le défaut ne casse rien mécaniquement — il MENT.
    // `default` veut dire que la boîte de dialogue s'est fermée sans choix : un clic à côté, une
    // touche Échap, un onglet qui perd le focus. Lui servir le texte du refus, qui la renvoie aux
    // réglages du navigateur, lui apprend qu'il n'y a plus rien à faire là où un second appui sur le
    // même bouton aurait marché. C'est le pire des deux mondes : une porte ouverte, annoncée fermée.
    const { demande } = navigateurCapable({ permission: "default" });
    const p = proprietes();
    render(<Reglages {...p} />);
    screen.getByRole("button", { name: ACTIVER }).click();

    await waitFor(() =>
      expect(screen.getByTestId("message-reglages").textContent).toBe(PERMISSION_SANS_REPONSE),
    );
    expect(
      screen.getByTestId("message-reglages").textContent,
      "on lui a dit qu'elle avait refusé alors qu'elle n'a rien répondu",
    ).not.toBe(PERMISSION_REFUSEE);
    expect(p.abonner, "on a enregistré un appareil sans permission").not.toHaveBeenCalled();

    // …et le geste reste disponible : le bouton n'a pas changé de rôle, il repose la question.
    const bouton = screen.getByRole("button", { name: ACTIVER });
    await waitFor(() => expect((bouton as HTMLButtonElement).disabled).toBe(false));
    bouton.click();
    await waitFor(() => expect(demande).toHaveBeenCalledTimes(2));
  });

  it("[ANTI-VACUITÉ] les deux textes ne sont pas le même — sans quoi la garde ci-dessus est vide", () => {
    // Une distinction d'état qui rendrait la MÊME phrase serait une distinction pour rien : le test
    // ci-dessus passerait, et l'utilisatrice lirait toujours qu'elle a refusé.
    expect(PERMISSION_SANS_REPONSE).not.toBe(PERMISSION_REFUSEE);
    expect(PERMISSION_SANS_REPONSE.length).toBeGreaterThan(20);
  });

  it("[LE CŒUR] un navigateur incapable ne voit MÊME PAS la boîte de dialogue", async () => {
    // Safari iOS hors écran d'accueil. Demander une permission qu'on ne pourra pas utiliser
    // produirait une boîte de dialogue pour rien — et un refus définitif en prime.
    const { demande } = navigateurCapable();
    // ⚠️ On SUPPRIME la propriété, on ne la met pas à `undefined` : la détection de capacité s'écrit
    // `"PushManager" in window`, et un `stubGlobal(..., undefined)` DÉFINIT quand même la clé — le
    // test passerait donc à côté, en croyant simuler un navigateur incapable. La forme `in` est la
    // bonne dans le composant (c'est la détection standard) ; c'était la mise en scène qui mentait.
    Reflect.deleteProperty(globalThis, "PushManager");
    render(<Reglages {...proprietes()} />);
    screen.getByRole("button", { name: ACTIVER }).click();
    await waitFor(() => expect(screen.getByTestId("message-reglages").textContent).toBe(INDISPONIBLE));
    expect(demande).not.toHaveBeenCalled();
  });

  it("[LE CŒUR] si la base refuse, le navigateur est DÉSABONNÉ à son tour", async () => {
    // ⚠️ Sans ça, les deux mondes divergent : le navigateur se croit abonné, la base ne le sait pas.
    // Elle ne recevrait jamais rien, et le bouton lui proposerait de s'abonner encore — sur un
    // endpoint que le navigateur rendrait identique. Une boucle silencieuse.
    const { desabonner } = navigateurCapable();
    const p = proprietes({ abonner: vi.fn(async () => ({ statut: "erreur" })) });
    render(<Reglages {...p} />);
    screen.getByRole("button", { name: ACTIVER }).click();
    await waitFor(() => expect(desabonner).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("etat-abonnement").textContent).toBe(ETAT_INACTIF);
  });
});

describe("[6.2/AC4] l'heure, le retrait, et le palier qu'on ne cache pas", () => {
  it("choisir une heure l'enregistre", async () => {
    navigateurCapable();
    const p = proprietes();
    render(<Reglages {...p} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("8");
    select.value = "21";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(() => expect(p.choisirHeure).toHaveBeenCalledWith(21));
  });

  it("les vingt-quatre heures du jour civil sont proposées, et elles seules", () => {
    navigateurCapable();
    render(<Reglages {...proprietes()} />);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(24);
    expect(options[0].textContent).toBe("00 h");
    expect(options[23].textContent).toBe("23 h");
  });

  it("se retirer défait les DEUX côtés", async () => {
    const { desabonner } = navigateurCapable();
    const p = proprietes({ abonneIci: true });
    render(<Reglages {...p} />);
    screen.getByRole("button", { name: DESACTIVER }).click();
    await waitFor(() => expect(p.desabonner).toHaveBeenCalledWith("https://web.push.apple.com/anam-essai"));
    expect(desabonner).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId("etat-abonnement").textContent).toBe(ETAT_INACTIF));
  });

  it("[LE CŒUR] un palier hors service se DIT, il ne se cache pas", async () => {
    // ⚠️ L'alternative — accepter le réglage en silence — reviendrait à lui promettre une
    // notification qui n'arrivera pas. La panne serait invisible pour elle comme pour nous, et elle
    // conclurait que le produit est cassé plutôt que pas encore en service.
    navigateurCapable();
    render(<Reglages {...proprietes({ enService: false })} />);
    expect(screen.getByTestId("message-reglages").textContent).toBe(PAS_ENCORE_ACTIF);
  });

  it("[ANTI-VACUITÉ] en service, l'écran ne dit rien de particulier", async () => {
    navigateurCapable();
    render(<Reglages {...proprietes({ enService: true })} />);
    expect(screen.getByTestId("message-reglages").textContent).toBe("");
  });
});
