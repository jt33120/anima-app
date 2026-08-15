import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Story 6.1 (T8, AC10) — LE DÉPÔT DE L'ORDONNANCEUR NE PEUT PLUS PENDRE.
 *
 * ⚠️ Pourquoi ce fichier existe séparément, et pourquoi le test ne peut PAS vivre dans
 * `ordonnanceur-executeur.test.ts` : là-bas, le dépôt est un objet factice fabriqué à la main. Un
 * faux `reclamer` qui ne résout jamais prouverait seulement que le répartiteur n'a pas d'échéance
 * globale — ce qui est vrai, assumé, et hors périmètre de cette story. **La borne construite par la
 * 6.1 vit dans le VRAI dépôt**, autour du client Supabase ; c'est donc lui qu'il faut exercer, avec
 * un client qui se tait.
 *
 * Ce que le silence coûtait : `avecDelai` protégeait `job.executer`, jamais la mécanique autour. Une
 * base muette faisait pendre `reclamer` jusqu'à ce que la plateforme tue la lambda — rien de clos,
 * aucun incident levé, la ligne laissée `en_cours` sous son bail. Un échec totalement muet, et le
 * pire des trois : même pas le faux `job_echoue` du dépassement ordinaire.
 *
 * Un `try/catch` n'aurait rien changé : il attrape des rejets, jamais une attente.
 */

/** Un thenable qui ne résout JAMAIS — la panne la plus banale d'une base : le silence. */
function jamais(): PromiseLike<never> {
  return { then: () => {} } as unknown as PromiseLike<never>;
}

const clientMuet = {
  from: () => ({ select: () => ({ maybeSingle: () => jamais() }) }),
  rpc: () => jamais(),
};

/**
 * Ce que la RPC répond, quand elle répond (Story 6.1a). Le mutable est volontaire : le même module
 * mocké sert les deux moitiés du fichier — celle qui n'obtient jamais de réponse, et celle qui en
 * obtient une qu'elle n'attendait pas.
 */
let reponseRpc: { data: unknown; error: unknown } | null = null;

vi.mock("@/lib/data/supabase/admin", () => ({
  createSupabaseAdminClient: () =>
    reponseRpc === null ? clientMuet : { from: clientMuet.from, rpc: async () => reponseRpc },
}));

const { creerDepotOrdonnanceur } = await import("@/lib/data/depot-ordonnanceur");

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("[6.1/AC10] les cinq méthodes du dépôt sont BORNÉES", () => {
  // Chacune est nommée : une garde de source dit qu'elles passent toutes par `borne(...)`, celle-ci
  // dit ce que `borne(...)` produit réellement. La première prouve le câblage, la seconde l'effet —
  // et il a déjà suffi d'un `Promise.resolve` oublié pour que le câblage soit là et l'effet non.
  const methodes: [string, (d: ReturnType<typeof creerDepotOrdonnanceur>) => Promise<unknown>][] = [
    ["reclamer", (d) => d.reclamer("j", "2026-08-06", null, 60)],
    ["clore", (d) => d.clore("j", "2026-08-06", null, true, null, "00000000-0000-4000-8000-000000000000")],
    ["etat", (d) => d.etat()],
    ["leverIncident", (d) => d.leverIncident("job_echoue", "j", "code")],
  ];

  for (const [nom, appeler] of methodes) {
    it(`\`${nom}\` REJETTE au bout du délai plutôt que d'attendre indéfiniment`, async () => {
      // Mutation-cible : retirer le `borne(...)` de cette méthode. Sans lui, cette promesse ne se
      // règle jamais et le test échoue en dépassement — le contraire d'un test qui passe par
      // inadvertance.
      const depot = creerDepotOrdonnanceur();
      const promesse = appeler(depot);
      // On capture le rejet AVANT d'avancer l'horloge : autrement le rejet est non géré pendant un
      // tour de boucle, et Vitest le signale comme une erreur non attrapée.
      const issue = promesse.then(
        () => "resolu",
        (e: Error) => e.message,
      );
      await vi.advanceTimersByTimeAsync(5_000);
      await expect(issue).resolves.toMatch(/_timeout$/);
    });
  }

  it("[LE CŒUR] `environnementDeclare` rend `null` — elle ne LÈVE pas, même sur délai dépassé", async () => {
    // ⚠️ C'est la seule des cinq à promettre de ne jamais lever, et la revue de la 6.1 a montré que
    // l'ajout du délai lui avait fait rompre cette promesse EN SILENCE. `verifierEnvironnement` ne
    // rattrape rien, `executer.ts:40` non plus, `app/api/ordonnanceur/route.ts:50` non plus : une
    // base MUETTE — exactement le cas que la borne existe pour traiter — remontait en 500 au lieu du
    // refus `base_muette` documenté, avec son incident de sécurité.
    //
    // Le repli produisait donc PLUS de dégât que le chemin nominal : l'exact inverse d'AD-15. Et
    // c'était invisible, parce que le type `Promise<string | null>` ne dit rien des exceptions.
    //
    // Mutation-cible : retirer le `try/catch` autour du `borne(...)` de cette méthode.
    const depot = creerDepotOrdonnanceur();
    const issue = depot.environnementDeclare().then(
      (v) => ({ ok: true, v }),
      (e: Error) => ({ ok: false, v: e.message }),
    );
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await issue, "l'ignorance se dit `null`, elle ne se jette pas").toEqual({ ok: true, v: null });
  });

  it("[LE CŒUR] une base muette fait REFUSER l'ordonnanceur, elle ne le fait pas exploser", async () => {
    // Le pendant comportemental du test ci-dessus, au niveau où la conséquence se voit. Sans lui, on
    // saurait que la méthode rend `null` sans savoir ce que le produit en fait — or c'est là qu'est
    // la propriété : « dans le doute, aucun effet » (AC3, AD-15).
    const { executerOrdonnanceur } = await import("@/lib/ordonnanceur/executer");
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    const rapport = executerOrdonnanceur({ depot: creerDepotOrdonnanceur(), registre: [] });
    await vi.advanceTimersByTimeAsync(5_000);
    const resultat = await rapport;
    expect(resultat.execute, "aucun job n'a tourné").toBe(false);
    expect(resultat.refus, "et le refus est celui qui est documenté").toBe("base_muette");
    expect(espion, "avec sa trace de sécurité — un refus muet serait un refus qu'on ne saurait pas").toHaveBeenCalled();
    espion.mockRestore();
  });

  it("[MÉTA] le client factice se tait VRAIMENT — sans quoi tout ce fichier est décoratif", async () => {
    // Si `jamais()` résolvait, les cinq tests ci-dessus passeraient sans qu'aucun délai ne serve à
    // rien : ils prouveraient « la méthode se règle », ce qui est vrai de n'importe quel appel. La
    // propriété testée est le REJET SUR DÉLAI, et elle exige un silence réel en face.
    let regle = false;
    void Promise.resolve(clientMuet.rpc()).then(
      () => (regle = true),
      () => (regle = true),
    );
    await vi.advanceTimersByTimeAsync(60_000);
    expect(regle, "le client factice ne doit ni résoudre ni rejeter").toBe(false);
  });

  it("[LE CŒUR] le `Promise.resolve` n'est pas décoratif : un thenable nu casserait `avecDelai`", async () => {
    // ⚠️ Le piège déjà payé au défaut n°8 de la revue 4.8, et la raison pour laquelle la garde de
    // source ne suffit pas. Le constructeur de requête de PostgREST est un THENABLE : il porte
    // `then`, mais ni `catch` ni `finally`. Or `avecDelai` appelle `.finally` pour désarmer son
    // minuteur. Le lui passer nu lève un `TypeError` — le câblage serait visible, la borne absente,
    // et l'erreur ressemblerait à une panne de base plutôt qu'à un défaut de notre code.
    //
    // Mutation-cible : remplacer `avecDelai(Promise.resolve(requete), …)` par `avecDelai(requete, …)`.
    const { avecDelai } = await import("@/lib/domain/delai");
    const nu = jamais() as unknown as Promise<never>;
    expect(typeof (nu as { finally?: unknown }).finally, "un thenable PostgREST n'a pas de `finally`").toBe(
      "undefined",
    );
    // ⚠️ Et il LÈVE de façon SYNCHRONE, il ne rejette pas : `avecDelai` appelle `.finally` avant
    // d'avoir construit sa course. Un `await` autour ne l'attraperait donc pas au même endroit qu'un
    // rejet ordinaire — ce qui est précisément ce qui rendait le défaut n°8 difficile à lire dans un
    // journal de production.
    expect(() => avecDelai(nu, 10, "x_timeout")).toThrow(TypeError);
  });
});

describe("[6.1a] une réponse qu'on ne comprend pas n'est pas un feu vert", () => {
  afterEach(() => {
    reponseRpc = null;
  });

  /**
   * ⚠️ CE BLOC EST NÉ D'UN MUTANT SURVIVANT. Remplacer le test de forme du dépôt par un `data ?? null`
   * ne faisait rougir aucun test : contre le vrai Postgres, la RPC ne rend jamais qu'un uuid ou `null`,
   * et les deux écritures s'y comportent pareil. Ce n'est pourtant PAS une équivalence — c'est un trou
   * de couverture, et le seul moyen de l'exercer est de faire répondre à la base ce qu'elle ne répond
   * pas d'elle-même.
   *
   * Ce que ça protège, très concrètement : PostgREST rend `false` (une régression de sérialisation,
   * une fonction renommée dont la surcharge ancienne répondrait encore un booléen). Avec `data ?? null`,
   * `false` n'est pas `null` — le répartiteur reçoit donc un « jeton » et EXÉCUTE LE JOB. Sur la
   * rétention de l'Epic 6, c'est une purge lancée sur une fenêtre qu'on ne détient pas.
   *
   * La règle est celle du dépôt depuis la 4.8, seulement transposée au nouveau type de retour :
   * **dans le doute, NE PAS exécuter.**
   */
  it("`reclamer` ne rend un jeton que si la base a répondu une CHAÎNE", async () => {
    for (const data of [false, 0, true, {}, [], ""]) {
      reponseRpc = { data, error: null };
      const depot = creerDepotOrdonnanceur();
      expect(await depot.reclamer("j", "f", null, 60), `réponse ${JSON.stringify(data)}`).toBeNull();
    }

    // CONTRÔLE POSITIF, sans quoi la garde serait satisfaite par un dépôt qui ne réclame plus jamais rien.
    reponseRpc = { data: "3f2b0c8e-0000-4000-8000-000000000001", error: null };
    expect(await creerDepotOrdonnanceur().reclamer("j", "f", null, 60)).toBe(
      "3f2b0c8e-0000-4000-8000-000000000001",
    );
  });

  it("`clore` ne dit « j'ai clos » que si la base a répondu VRAI", async () => {
    // Le pendant exact, et il penche du même côté : « je n'ai pas compris la réponse » se rapporte
    // comme un refus. C'est le repli le moins affirmatif des deux, et le seul qui laisse une trace.
    for (const data of [null, undefined, "true", 1, {}]) {
      reponseRpc = { data, error: null };
      expect(
        await creerDepotOrdonnanceur().clore("j", "f", null, true, null, "jeton"),
        `réponse ${JSON.stringify(data)}`,
      ).toBe(false);
    }

    reponseRpc = { data: true, error: null };
    expect(await creerDepotOrdonnanceur().clore("j", "f", null, true, null, "jeton")).toBe(true);
  });
});
