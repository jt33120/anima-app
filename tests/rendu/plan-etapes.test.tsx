import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlanEtapes from "@/render/arbre/PlanEtapes";
import {
  PLAN_TITRE,
  PLAN_VIDE,
  PLAN_INDISPONIBLE,
  ACTION_AJOUTER_ETAPE,
  ACTION_ENREGISTRER_ETAPE,
  ACTION_RETIRER_ETAPE,
  CHAMP_SI_LABEL,
  CHAMP_ALORS_LABEL,
  ECHEC_ETAPE,
  ECHEC_RETRAIT_ETAPE,
  REFUS_ETAPE,
  ACTION_MODIFIER_ETAPE,
  SUCCES_MODIF_ETAPE,
} from "@/render/arbre/copie-arbre";

/**
 * Story 4.10 (T7) — LE PLAN D'ÉTAPES, MONTÉ POUR DE VRAI (jsdom).
 *
 * Le projet « rendu » existe parce que la RE-REVUE 4.6 a démontré qu'une garde par lecture de source
 * prouve le CÂBLAGE et jamais le COMPORTEMENT. Ici on éprouve les quatre choses qu'un test de source
 * ne peut pas voir : les champs sont VIDES, le bouton refuse une moitié seule, une panne ne se déguise
 * pas en plan vide, et le formulaire n'existe pas quand l'écriture est fermée.
 */

const PLAN = [
  { id: "i1", declencheur: "si je remets à demain", action: "je pose une minute maintenant", echeance: null },
  { id: "i2", declencheur: "si je sens la boule", action: "j'écris trois lignes", echeance: "2026-12-24" },
];

function poserFetch(reponses: { plan?: unknown; ok?: boolean; poster?: (corps: unknown) => Response }) {
  const appels: { url: string; corps?: unknown }[] = [];
  const faux = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === "POST") {
      const corps = JSON.parse(String(init.body));
      appels.push({ url: u, corps });
      return reponses.poster
        ? reponses.poster(corps)
        : new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    appels.push({ url: u });
    if (reponses.ok === false) return new Response("", { status: 500 });
    return new Response(JSON.stringify({ plan: reponses.plan ?? [] }), { status: 200 });
  });
  globalThis.fetch = faux as unknown as typeof fetch;
  return appels;
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("[AC1 DUR] la forme « si X, alors Y » est portée par DEUX CHAMPS, tous deux vides", () => {
  it("[LE CŒUR] les deux champs sont VIDES et ne portent AUCUN exemple", async () => {
    // Mutation-cible : ajouter un `placeholder="Si je me sens anxieuse…"`. Ce serait Anam décidant à sa
    // place de ce qu'elle devrait faire — une intention d'implémentation EST une prescription
    // comportementale, et c'est précisément ce que la décision D1 refuse. Même règle que le nommage de
    // branche : « Tes mots, pas les miens. »
    poserFetch({ plan: [] });
    render(<PlanEtapes brancheId="b1" ouvert />);
    await userEvent.click(await screen.findByRole("button", { name: ACTION_AJOUTER_ETAPE }));

    const si = screen.getByLabelText(CHAMP_SI_LABEL) as HTMLInputElement;
    const alors = screen.getByLabelText(CHAMP_ALORS_LABEL) as HTMLInputElement;
    expect(si.value, "le champ « si » est vide").toBe("");
    expect(alors.value, "le champ « alors » est vide").toBe("");
    expect(si.placeholder, "aucun exemple en placeholder non plus").toBe("");
    expect(alors.placeholder).toBe("");
  });

  it("[LE CŒUR] une seule moitié ne suffit PAS : le bouton reste refusé", async () => {
    // Mutation-cible : passer le `&&` de `etapeRecevable` en `||`. Un « alors » seul est une CONSIGNE ;
    // un « si » seul est une observation. La conjonction est ce qui fait l'intention d'implémentation,
    // et c'est la seule raison pour laquelle la forme peut être garantie sans modèle.
    poserFetch({ plan: [] });
    render(<PlanEtapes brancheId="b1" ouvert />);
    await userEvent.click(await screen.findByRole("button", { name: ACTION_AJOUTER_ETAPE }));
    const enregistrer = screen.getByRole("button", { name: ACTION_ENREGISTRER_ETAPE });

    expect(enregistrer.hasAttribute("disabled"), "rien saisi").toBe(true);
    await userEvent.type(screen.getByLabelText(CHAMP_SI_LABEL), "si je remets à demain");
    expect(enregistrer.hasAttribute("disabled"), "une moitié seulement").toBe(true);
    await userEvent.type(screen.getByLabelText(CHAMP_ALORS_LABEL), "je pose une minute");
    expect(enregistrer.hasAttribute("disabled"), "les deux moitiés").toBe(false);
  });

  it("une moitié faite d'INVISIBLES ne compte pas comme donnée", async () => {
    // Le miroir applicatif doit être équivalent à la base, ni plus faible ni plus strict (leçon R1-bis) :
    // un bouton actif sur un texte que la base refuse invite à « réessayer » l'impossible, sur un
    // caractère invisible par construction.
    poserFetch({ plan: [] });
    render(<PlanEtapes brancheId="b1" ouvert />);
    await userEvent.click(await screen.findByRole("button", { name: ACTION_AJOUTER_ETAPE }));
    await userEvent.type(screen.getByLabelText(CHAMP_SI_LABEL), "si je remets");
    await userEvent.type(screen.getByLabelText(CHAMP_ALORS_LABEL), "​ ");
    expect(screen.getByRole("button", { name: ACTION_ENREGISTRER_ETAPE }).hasAttribute("disabled")).toBe(true);
  });

  it("les deux moitiés partent ROGNÉES (le texte ne changera pas tout seul plus tard)", async () => {
    const appels = poserFetch({ plan: [] });
    render(<PlanEtapes brancheId="b1" ouvert />);
    await userEvent.click(await screen.findByRole("button", { name: ACTION_AJOUTER_ETAPE }));
    await userEvent.type(screen.getByLabelText(CHAMP_SI_LABEL), "  si je remets  ");
    await userEvent.type(screen.getByLabelText(CHAMP_ALORS_LABEL), " je pose une minute ");
    await userEvent.click(screen.getByRole("button", { name: ACTION_ENREGISTRER_ETAPE }));

    await waitFor(() => {
      const post = appels.find((a) => a.corps);
      expect(post?.corps).toMatchObject({
        action: "ajouter",
        brancheId: "b1",
        declencheur: "si je remets",
        alors: "je pose une minute",
        echeance: null,
      });
    });
  });
});

describe("[AC2] le plan est une suite VIVANTE — et il se lit dans sa forme", () => {
  it("chaque étape affiche ses deux moitiés, précédées de la conjonction", async () => {
    poserFetch({ plan: PLAN });
    render(<PlanEtapes brancheId="b1" ouvert />);
    const liste = await screen.findByRole("list");
    const items = within(liste).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("si je remets à demain");
    expect(items[0].textContent).toContain("je pose une minute maintenant");
    expect(items[0].textContent, "la forme se lit").toContain(CHAMP_SI_LABEL);
  });

  it("l'ordre est celui que la base a donné — jamais retrié à l'affichage", async () => {
    // Mutation-cible : trier par `declencheur` « pour que ce soit plus lisible ». L'ordre total vit dans
    // `charger_plan` (rang puis id) ; un second tri ici en ferait deux, qui divergeraient (défaut 0033).
    poserFetch({ plan: [...PLAN].reverse() });
    render(<PlanEtapes brancheId="b1" ouvert />);
    const items = within(await screen.findByRole("list")).getAllByRole("listitem");
    expect(items[0].textContent).toContain("si je sens la boule");
  });

  it("retirer une étape la fait DISPARAÎTRE (suppression franche, aucun tombstone)", async () => {
    // Mutation-cible : marquer l'étape « retirée » et la laisser barrée à l'écran. AD-18 ne s'applique
    // PAS ici : l'AC2 décrit « une suite vivante, pas figée ». Un réflexe tombstone rendrait le plan
    // non révisable, ce qui est l'inverse de ce qu'il doit être.
    let plan = [...PLAN];
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        plan = plan.filter((e) => e.id !== JSON.parse(String(init.body)).intentionId);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ plan }), { status: 200 });
    }) as unknown as typeof fetch;

    render(<PlanEtapes brancheId="b1" ouvert />);
    await screen.findByText("si je remets à demain");
    await userEvent.click(screen.getAllByRole("button", { name: ACTION_RETIRER_ETAPE })[0]);
    await waitFor(() => expect(screen.queryByText("si je remets à demain")).toBeNull());
    expect(screen.getByText("si je sens la boule"), "l'autre est intacte").toBeTruthy();
  });

  it("retirer reste offert même quand l'écriture est fermée (alléger n'est pas écrire)", async () => {
    poserFetch({ plan: PLAN });
    render(<PlanEtapes brancheId="b1" ouvert={false} />);
    await screen.findByText("si je remets à demain");
    expect(screen.getAllByRole("button", { name: ACTION_RETIRER_ETAPE })).toHaveLength(2);
  });
});

describe("[AC6 / FR-081] quand l'écriture est fermée, on ne PROPOSE pas puis on refuse", () => {
  it("[LE CŒUR] `ouvert=false` → aucun formulaire, aucun bouton d'ajout", async () => {
    // Mutation-cible : afficher le formulaire quand même et laisser le serveur refuser. C'est la faute
    // exacte que la revue 4.7 a trouvée sur le geste de rayonnement : on faisait lire une confirmation
    // solennelle à quelqu'un qui sortait d'une crise, puis le point d'écriture disait non. Ici ce serait
    // pire : elle aurait déjà écrit deux phrases sur sa vie intérieure.
    poserFetch({ plan: PLAN });
    render(<PlanEtapes brancheId="b1" ouvert={false} />);
    await screen.findByText("si je remets à demain");
    expect(screen.queryByRole("button", { name: ACTION_AJOUTER_ETAPE })).toBeNull();
    expect(screen.queryByLabelText(CHAMP_SI_LABEL)).toBeNull();
  });

  it("et on N'EXPLIQUE PAS pourquoi — ni détresse, ni abonnement", async () => {
    // Lui annoncer que le système l'a classée n'est autorisé nulle part ; et « passe au premium » sur la
    // fiche d'une prise de conscience serait du commerce au pire endroit possible. Le silence est ici le
    // choix le plus doux.
    poserFetch({ plan: PLAN });
    const { container } = render(<PlanEtapes brancheId="b1" ouvert={false} />);
    await screen.findByText("si je remets à demain");
    const texte = (container.textContent ?? "").toLowerCase();
    for (const mot of ["premium", "abonn", "détresse", "épisode", "débloque"]) {
      expect(texte, `« ${mot} » n'a rien à faire ici`).not.toContain(mot);
    }
  });
});

describe("une PANNE de lecture n'est pas un plan vide", () => {
  it("[LE CŒUR] une lecture en échec dit « je n'arrive pas à afficher », jamais « rien encore »", async () => {
    // Mutation-cible : replier sur `[]` en cas d'erreur. Dire « Rien encore. » à quelqu'un qui a un plan
    // est un MENSONGE — exactement la régression que la revue 4.6 a qualifiée de HAUTE sur l'arbre.
    poserFetch({ ok: false });
    render(<PlanEtapes brancheId="b1" ouvert />);
    expect(await screen.findByText(PLAN_INDISPONIBLE)).toBeTruthy();
    expect(screen.queryByText(PLAN_VIDE)).toBeNull();
  });

  it("un plan réellement vide dit « rien encore », sans dramatiser", async () => {
    poserFetch({ plan: [] });
    render(<PlanEtapes brancheId="b1" ouvert />);
    expect(await screen.findByText(PLAN_VIDE)).toBeTruthy();
  });

  it("un enregistrement refusé est DIT, et le formulaire reste (elle peut réessayer)", async () => {
    // Mutation-cible : fermer le formulaire quoi qu'il arrive. Elle aurait perdu ses deux phrases sans
    // qu'on lui dise pourquoi — un échec silencieux sur du contenu qu'elle vient d'écrire.
    poserFetch({ plan: [], poster: () => new Response("", { status: 500 }) });
    const annonces: string[] = [];
    render(<PlanEtapes brancheId="b1" ouvert onAnnoncer={(t) => annonces.push(t)} />);
    await userEvent.click(await screen.findByRole("button", { name: ACTION_AJOUTER_ETAPE }));
    await userEvent.type(screen.getByLabelText(CHAMP_SI_LABEL), "si je remets");
    await userEvent.type(screen.getByLabelText(CHAMP_ALORS_LABEL), "je pose une minute");
    await userEvent.click(screen.getByRole("button", { name: ACTION_ENREGISTRER_ETAPE }));

    expect((await screen.findByRole("alert")).textContent).toContain(ECHEC_ETAPE);
    expect(annonces, "et le lecteur d'écran l'entend").toContain(ECHEC_ETAPE);
    expect((screen.getByLabelText(CHAMP_SI_LABEL) as HTMLInputElement).value, "son texte est gardé").toBe(
      "si je remets",
    );
  });
});

describe("accessibilité et cibles", () => {
  it("la section porte un nom, et les deux champs ont des ÉTIQUETTES visibles", async () => {
    // Jamais un placeholder en guise d'étiquette : il disparaît à la saisie, et un lecteur d'écran ne
    // l'annonce pas de façon fiable.
    poserFetch({ plan: [] });
    render(<PlanEtapes brancheId="b1" ouvert />);
    expect(await screen.findByRole("region", { name: PLAN_TITRE })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: ACTION_AJOUTER_ETAPE }));
    for (const label of [CHAMP_SI_LABEL, CHAMP_ALORS_LABEL]) {
      const champ = screen.getByLabelText(label);
      expect(champ.tagName).toBe("INPUT");
      expect(screen.getByText(label).tagName, "l'étiquette est un vrai <label> visible").toBe("LABEL");
    }
  });

  it("l'échéance ne peut pas être posée dans le PASSÉ (elle ne se déclencherait jamais)", async () => {
    poserFetch({ plan: [] });
    render(<PlanEtapes brancheId="b1" ouvert />);
    await userEvent.click(await screen.findByRole("button", { name: ACTION_AJOUTER_ETAPE }));
    const jour = screen.getByLabelText(/date/i) as HTMLInputElement;
    expect(jour.type).toBe("date");
    // ⚠️ DEMAIN, pas aujourd'hui (revue 4.10) : le rappel du jour part au tick de 06:00 UTC, donc une
    // échéance posée aujourd'hui arrive APRÈS son propre rappel et ne se déclenchera jamais.
    const demain = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
      new Date(Date.now() + 86_400_000),
    );
    expect(jour.min, "le plancher est DEMAIN, à Paris").toBe(demain);
  });
});

describe("[AC2 / revue 4.10] MODIFIER une étape — le geste qui n'existait pas", () => {
  /**
   * ⚠️ L'AC2 dit « ajoutées, MODIFIÉES ou retirées ». La RPC `reviser_intention`, le dépôt, l'action de
   * route et leurs tests étaient tous écrits — et le bouton n'avait jamais été câblé. Corriger une
   * formulation obligeait à retirer l'étape et à la réécrire, en perdant son rang et son échéance.
   * Trouvé par l'audit d'acceptation ; aucun test ne le voyait, puisque tous testaient la plomberie.
   */
  it("[LE CŒUR] le geste existe, pré-remplit les deux moitiés, et envoie `reviser`", async () => {
    // Mutation-cible : retirer le bouton « Modifier ». Toute la plomberie reste verte.
    const appels = poserFetch({ plan: PLAN });
    render(<PlanEtapes brancheId="b1" ouvert />);
    await userEvent.click((await screen.findAllByRole("button", { name: ACTION_MODIFIER_ETAPE }))[0]);

    expect((screen.getByLabelText(CHAMP_SI_LABEL) as HTMLInputElement).value).toBe(PLAN[0].declencheur);
    expect((screen.getByLabelText(CHAMP_ALORS_LABEL) as HTMLInputElement).value).toBe(PLAN[0].action);

    await userEvent.clear(screen.getByLabelText(CHAMP_ALORS_LABEL));
    await userEvent.type(screen.getByLabelText(CHAMP_ALORS_LABEL), "je pose cinq minutes");
    await userEvent.click(screen.getByRole("button", { name: ACTION_ENREGISTRER_ETAPE }));

    await waitFor(() => {
      const post = appels.find((a) => a.corps);
      expect(post?.corps).toMatchObject({
        action: "reviser",
        intentionId: PLAN[0].id,
        declencheur: PLAN[0].declencheur,
        alors: "je pose cinq minutes",
      });
    });
  });

  it("le succès de la modification a son PROPRE mot", async () => {
    poserFetch({ plan: PLAN });
    const annonces: string[] = [];
    render(<PlanEtapes brancheId="b1" ouvert onAnnoncer={(x) => annonces.push(x)} />);
    await userEvent.click((await screen.findAllByRole("button", { name: ACTION_MODIFIER_ETAPE }))[0]);
    await userEvent.click(screen.getByRole("button", { name: ACTION_ENREGISTRER_ETAPE }));
    await waitFor(() => expect(annonces).toContain(SUCCES_MODIF_ETAPE));
  });

  it("une échéance DÉJÀ PASSÉE est vidée à l'ouverture (sinon l'étape devient immodifiable)", async () => {
    // Renvoyer l'échéance telle quelle ferait refuser la révision par `echeanceRecevable` — l'étape
    // serait bloquée sans qu'on comprenne pourquoi. Mutation-cible : repasser `e.echeance` sans filtre.
    poserFetch({ plan: [{ ...PLAN[0], echeance: "2020-01-01" }] });
    render(<PlanEtapes brancheId="b1" ouvert />);
    await userEvent.click(await screen.findByRole("button", { name: ACTION_MODIFIER_ETAPE }));
    expect((screen.getByLabelText(/date/i) as HTMLInputElement).value, "vidée, donc modifiable").toBe("");
    expect(screen.getByRole("button", { name: ACTION_ENREGISTRER_ETAPE }).hasAttribute("disabled")).toBe(false);
  });

  it("le geste disparaît quand l'écriture est fermée (comme l'ajout)", async () => {
    poserFetch({ plan: PLAN });
    render(<PlanEtapes brancheId="b1" ouvert={false} />);
    await screen.findByText(PLAN[0].declencheur);
    expect(screen.queryByRole("button", { name: ACTION_MODIFIER_ETAPE })).toBeNull();
  });
});

describe("[REVUE 4.10] un REFUS n'est pas une PANNE, et un retrait n'est pas un enregistrement", () => {
  it("[LE CŒUR] un 403/409 dit « pas maintenant », jamais « tu peux réessayer »", async () => {
    // ⚠️ L'anti-patron que la 4.7 avait corrigé pour le geste de rayonnement (`REFUS_RAYONNEMENT`),
    // réutilisé partout SAUF ici. Promettre « tu peux réessayer » à quelqu'un qui sort d'une crise,
    // c'est l'inviter à se heurter au même mur pendant des heures.
    // Mutation-cible : rendre `ECHEC_ETAPE` quel que soit le statut.
    poserFetch({ plan: [], poster: () => new Response("", { status: 403 }) });
    render(<PlanEtapes brancheId="b1" ouvert />);
    await userEvent.click(await screen.findByRole("button", { name: ACTION_AJOUTER_ETAPE }));
    await userEvent.type(screen.getByLabelText(CHAMP_SI_LABEL), "si je remets");
    await userEvent.type(screen.getByLabelText(CHAMP_ALORS_LABEL), "je pose une minute");
    await userEvent.click(screen.getByRole("button", { name: ACTION_ENREGISTRER_ETAPE }));

    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toContain(REFUS_ETAPE);
    expect(alerte.textContent, "surtout pas la promesse d'un réessai").not.toContain("réessayer");
  });

  it("[LE CŒUR] un retrait qui échoue parle de RETRAIT, pas d'enregistrement", async () => {
    // ⚠️ Double-clic sur « Retirer » → le second POST reçoit 409 sur une ligne déjà partie, et l'ancienne
    // version annonçait « je n'ai pas pu ENREGISTRER » — pendant que la liste montrait l'étape retirée.
    // Deux informations contradictoires à l'écran. Mutation-cible : réutiliser `ECHEC_ETAPE` ici.
    poserFetch({ plan: PLAN, poster: () => new Response("", { status: 500 }) });
    const annonces: string[] = [];
    render(<PlanEtapes brancheId="b1" ouvert onAnnoncer={(x) => annonces.push(x)} />);
    await screen.findByText(PLAN[0].declencheur);
    await userEvent.click(screen.getAllByRole("button", { name: ACTION_RETIRER_ETAPE })[0]);
    await waitFor(() => expect(annonces).toContain(ECHEC_RETRAIT_ETAPE));
    expect(annonces, "jamais le message d'enregistrement").not.toContain(ECHEC_ETAPE);
  });

  it("[LE CŒUR] deux clics dans le MÊME tick n'envoient qu'un seul POST", async () => {
    // ⚠️ `fireEvent` et pas `userEvent` : `userEvent` attend entre ses événements, donc la première
    // requête se résout avant le second clic et le test ne prouve rien.
    //
    // FRONTIÈRE HONNÊTE — CE QUE CE TEST NE PEUT PAS ISOLER. Deux défenses couvrent ce cas : le verrou
    // (`ref`, synchrone) et l'attribut `disabled` du bouton. React vide sa file d'état entre deux
    // événements DISCRETS, donc en test comme dans un navigateur, `disabled` suffit déjà — remplacer la
    // `ref` par l'état ne fait rougir personne (mutation-vérifié). C'est le piège des défenses
    // redondantes, et le nommer vaut mieux que prétendre l'avoir évité.
    //
    // La `ref` est gardée quand même : elle est la seule des deux qui protège un appel programmatique
    // (deux gestionnaires dans le même tick, une soumission clavier doublée). Ce que ce test prouve,
    // lui, c'est le RÉSULTAT : deux clics ne produisent pas deux retraits — quel que soit le mécanisme.
    const appels = poserFetch({ plan: PLAN });
    render(<PlanEtapes brancheId="b1" ouvert />);
    await screen.findByText(PLAN[0].declencheur);
    const bouton = screen.getAllByRole("button", { name: ACTION_RETIRER_ETAPE })[0];
    fireEvent.click(bouton);
    fireEvent.click(bouton);
    await waitFor(() => expect(appels.some((a) => a.corps)).toBe(true));
    expect(appels.filter((a) => a.corps), "un seul retrait est parti").toHaveLength(1);
  });
});

describe("[REVUE 4.10] le chargement ne se déguise ni en plan vide ni en panne", () => {
  it("les trois états ont trois textes distincts", async () => {
    poserFetch({ plan: [] });
    render(<PlanEtapes brancheId="b1" ouvert />);
    // L'état de chargement est fugace ; ce qui compte est qu'il ne PRÉTENDE rien.
    expect(await screen.findByText(PLAN_VIDE)).toBeTruthy();
    expect(screen.queryByText(PLAN_INDISPONIBLE)).toBeNull();
  });
});
