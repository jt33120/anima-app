import { describe, it, expect } from "vitest";
import { validerOrigine, origineDuSite } from "@/lib/courriel/origine";
import { jetonValide } from "@/lib/domain/jeton-desabonnement";
import { reglerCourrielsAvec } from "@/lib/courriel/desabonnement";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * REVUE 4.9 (T5-1 / T5-2) — LES DEUX SEULES VALEURS QUI ENTRENT DANS UN COURRIEL.
 *
 * Le gabarit n'a que deux trous, et ce fichier prouve que ni l'un ni l'autre ne peut porter autre chose
 * que ce qu'il annonce. C'est ce qui remplace l'ancienne garde « aucune interpolation dans le fichier »,
 * qui a dû céder : l'hôte ne peut pas être écrit en dur, et un lien de désabonnement qui ne désigne
 * personne ne désabonne personne.
 *
 * ── L'ORIGINE DU SITE (T5-1) ───────────────────────────────────────────────────────────────────────────
 *
 * Le gabarit portait `https://anima.app/synthese` en dur. Résolution DNS au moment de la revue :
 * `anima.app` est un domaine PARQUÉ et EN VENTE chez Afternic (NS afternic, MX null), qui n'apparaissait
 * nulle part ailleurs dans le dépôt — ni dans `next.config.ts`, ni dans `vercel.json`, ni dans
 * `.env.example`. Une URL inventée, reliée à aucun déploiement.
 *
 * Le danger n'est pas la page de parking : c'est que **n'importe qui peut acheter ce domaine** et servir
 * une fausse page de connexion Anam sur `/synthese`, à des femmes qu'un courriel signé « Anam » vient
 * d'avertir qu'un texte intime les attend. L'hameçonnage arrive alors avec la crédibilité du produit.
 *
 * Chaque refus ci-dessous correspond à un chemin d'attaque ou à une URL cassée, pas à du purisme.
 */

const origineEnv = process.env.ANIMA_SITE_URL;

describe("ce qui est ACCEPTÉ", () => {
  it("une origine https nue, avec ou sans barre finale", () => {
    expect(validerOrigine("https://anam.exemple")).toBe("https://anam.exemple");
    expect(validerOrigine("https://anam.exemple/")).toBe("https://anam.exemple");
    expect(validerOrigine("  https://anam.exemple//  "), "espaces et barres en trop").toBe(
      "https://anam.exemple",
    );
  });

  it("un port explicite et un sous-domaine (préversions Vercel)", () => {
    expect(validerOrigine("https://anam-git-story.vercel.app")).toBe("https://anam-git-story.vercel.app");
    expect(validerOrigine("https://anam.exemple:8443")).toBe("https://anam.exemple:8443");
  });

  it("`http` UNIQUEMENT en local — le développement doit rester possible", () => {
    expect(validerOrigine("http://localhost:3000")).toBe("http://localhost:3000");
    expect(validerOrigine("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
  });
});

describe("ce qui est REFUSÉ, et le chemin d'attaque derrière chaque refus", () => {
  it("[LE CŒUR] `http` hors local — un lien en clair est interceptable et rétrogradable", () => {
    expect(validerOrigine("http://anam.exemple")).toBeNull();
    expect(validerOrigine("http://anam.exemple:8080")).toBeNull();
  });

  it("[LE CŒUR] un identifiant dans l'URL — la forme classique du lien d'hameçonnage", () => {
    // `https://anam.exemple@méchant.test` : l'hôte affiché n'est pas l'hôte visité. Beaucoup de lectrices
    // s'arrêtent au premier mot après `https://`.
    expect(validerOrigine("https://anam.exemple@mechant.test")).toBeNull();
    expect(validerOrigine("https://utilisateur:motdepasse@anam.exemple")).toBeNull();
  });

  it("un chemin, une requête ou un fragment — le lien serait assemblé de travers", () => {
    // On construit `${origine}/synthese` ici : une origine qui porte déjà un chemin produirait
    // `https://hôte/base/synthese`, et une qui porte un `?` avalerait tout ce qui suit.
    expect(validerOrigine("https://anam.exemple/app")).toBeNull();
    expect(validerOrigine("https://anam.exemple/?ref=x")).toBeNull();
    expect(validerOrigine("https://anam.exemple/#ici")).toBeNull();
  });

  it("un protocole qui n'en est pas un", () => {
    expect(validerOrigine("javascript:alert(1)")).toBeNull();
    expect(validerOrigine("data:text/html,<h1>x</h1>")).toBeNull();
    expect(validerOrigine("ftp://anam.exemple")).toBeNull();
  });

  it("le vide, le blanc, l'absence, et ce qui n'est pas une URL", () => {
    expect(validerOrigine(undefined)).toBeNull();
    expect(validerOrigine(null)).toBeNull();
    expect(validerOrigine("")).toBeNull();
    expect(validerOrigine("   ")).toBeNull();
    expect(validerOrigine("anam.exemple"), "sans schéma, `new URL` lève").toBeNull();
    expect(validerOrigine("pas du tout une url")).toBeNull();
  });
});

describe("[T5-2] le JETON — le second trou, et la seule chose qui varie d'une personne à l'autre", () => {
  it("[LE CŒUR] rien qui ne soit un uuid ne devient un jeton", () => {
    // C'est ce qui referme le trou ouvert dans la signature du port. Sans cette validation, le troisième
    // paramètre d'`envoyer` accepterait une chaîne quelconque — c'est-à-dire, un jour, un fragment de
    // synthèse, qui partirait chez Resend et s'afficherait dans une URL.
    //
    // La vérification est à l'EXÉCUTION, pas seulement à la compilation : sinon un `as` suffirait à
    // rouvrir le trou, et un `as` est exactement ce qu'écrit quelqu'un de pressé.
    // Mutation-cible : accepter toute chaîne non vide (mutant SURVIVANT de la première campagne T5 —
    // aucun test ne regardait cette fonction).
    for (const refuse of [
      "",
      "   ",
      "pas-un-uuid",
      "Ta semaine a été difficile", // le scénario qu'on tue vraiment
      "11111111-1111-4111-8111-11111111111", // 35 caractères
      "11111111-1111-4111-8111-111111111111x",
      "11111111_1111_4111_8111_111111111111",
      "<script>alert(1)</script>",
      "../../etc/passwd",
      null,
      undefined,
    ]) {
      expect(jetonValide(refuse), `« ${String(refuse)} » ne doit pas devenir un jeton`).toBeNull();
    }
  });

  it("[CONTRÔLE POSITIF] un uuid en devient un, ébarbé, quelle que soit sa casse", () => {
    // Sans ce contrôle, la garde ci-dessus serait satisfaite par une fonction qui rend TOUJOURS `null` —
    // aucun courriel ne partirait jamais, et rien ne le dirait.
    expect(jetonValide("11111111-1111-4111-8111-111111111111")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(jetonValide("  11111111-1111-4111-8111-111111111111  ")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(jetonValide("AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE"), "Postgres rend du minuscule, mais pas partout").toBe(
      "AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE",
    );
  });
});

describe("[T5-2] le geste de désabonnement, sur client doublé", () => {
  function clientFactice(reponse: { data?: unknown; error?: unknown }) {
    const appels: unknown[] = [];
    const client = {
      async rpc(nom: string, args: unknown) {
        appels.push({ nom, args });
        return { data: reponse.data ?? null, error: reponse.error ?? null };
      },
    } as unknown as SupabaseClient;
    return { client, appels };
  }

  it("[LE CŒUR] une panne de base ne se dit JAMAIS « c'est fait »", async () => {
    // C'est la seule issue réellement dommageable de ce chemin : lui affirmer que les envois ont cessé
    // alors qu'ils continueront. Elle n'aurait plus aucune raison de recliquer, et le courriel suivant
    // arriverait quand même — après une page qui lui a dit le contraire.
    // Mutation-cible : `return error ? "fait" : …` (mutant SURVIVANT de la première campagne).
    const { client } = clientFactice({ error: { code: "PGRST000", message: "base indisponible" } });
    expect(
      await reglerCourrielsAvec(client, "11111111-1111-4111-8111-111111111111", true),
    ).toBe("inconnu");
  });

  it("[LE CŒUR] un jeton mal formé n'atteint PAS la base", async () => {
    // Cette route est ouverte à l'internet entier, sans authentification. Laisser passer n'importe quelle
    // chaîne jusqu'à Postgres offre à qui la sonde un aller-retour de base de données par requête, à coût
    // nul pour lui. Mutation-cible : retirer `if (!jeton) return "inconnu";` (mutant SURVIVANT).
    const { client, appels } = clientFactice({ data: true });
    expect(await reglerCourrielsAvec(client, "pas-un-uuid", true)).toBe("inconnu");
    expect(await reglerCourrielsAvec(client, null, true)).toBe("inconnu");
    expect(appels, "aucun appel à la base").toEqual([]);
  });

  it("un jeton valide passe, avec les DEUX arguments, dans le bon sens", async () => {
    const { client, appels } = clientFactice({ data: true });
    expect(await reglerCourrielsAvec(client, "11111111-1111-4111-8111-111111111111", false)).toBe("fait");
    expect(appels).toEqual([
      {
        nom: "regler_courriels_par_jeton",
        args: { p_jeton: "11111111-1111-4111-8111-111111111111", p_refuse: false },
      },
    ]);
  });

  it("une réponse qui n'est pas `true` vaut `inconnu` — jamais « c'est fait »", async () => {
    // `data === true`, pas `data`. Postgres rend `false` pour un jeton inconnu ; une comparaison lâche
    // ferait de `null` (panne partielle) et de `false` (jeton inconnu) des succès.
    for (const data of [false, null, 0, "true"]) {
      const { client } = clientFactice({ data });
      expect(
        await reglerCourrielsAvec(client, "11111111-1111-4111-8111-111111111111", true),
        `data = ${JSON.stringify(data)}`,
      ).toBe("inconnu");
    }
  });
});

describe("`origineDuSite` lit la configuration, et rien d'autre", () => {
  it("elle passe par la même validation — une variable mal remplie ne franchit rien", () => {
    try {
      process.env.ANIMA_SITE_URL = "https://depuis-lenv.exemple";
      expect(origineDuSite()).toBe("https://depuis-lenv.exemple");

      process.env.ANIMA_SITE_URL = "http://depuis-lenv.exemple";
      expect(origineDuSite(), "la validation s'applique aussi à l'env").toBeNull();

      delete process.env.ANIMA_SITE_URL;
      expect(origineDuSite(), "absente = pas d'envoi du tout").toBeNull();
    } finally {
      if (origineEnv === undefined) delete process.env.ANIMA_SITE_URL;
      else process.env.ANIMA_SITE_URL = origineEnv;
    }
  });
});
