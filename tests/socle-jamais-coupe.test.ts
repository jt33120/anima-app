import { describe, it, expect, vi, afterEach } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { doitCouperConversation } from "@/lib/domain/allocation-residuelle";
import { limiteAllocationResiduelle } from "@/lib/ai/allocation-config";
import { LIGNE_QUOTA_EPUISEE } from "@/render/conversation/ligne-quota";
import { chargerProjectionArbre } from "@/lib/safety/projection-arbre";
import { cartesDisponibles } from "@/lib/domain/bibliotheque";
import {
  carteEnneagramme,
  carteHoroscope,
  carteMantra,
  carteNombres,
  carteTheme,
} from "@/lib/domain/cartes-socle";
import { NON_ECRIT } from "@/lib/corpus/port";

/**
 * Story 3.3 (T6) — LE SOCLE N'EST JAMAIS COUPÉ (AC4 / FR-055, AC5 / FR-058).
 *
 * ── LA DIFFÉRENCE AVEC `tronc-absence.test.ts` ────────────────────────────────────────────────────────
 *
 * L'autre garde est NÉGATIVE : elle dit ce qui ne doit pas s'afficher. Celle-ci est POSITIVE : elle
 * énumère ce qui doit rester ACCESSIBLE, indéfiniment, sans payer — et le prouve item par item.
 *
 * ── ET SURTOUT : ELLE EST ARMÉE POUR L'EPIC 5 (T6-2) ──────────────────────────────────────────────────
 *
 * Cinq des huit items de FR-055 n'existent pas encore (numérologie, thème natal, horoscope, mantra,
 * ennéagramme). Un inventaire qui ne parlerait que du présent serait un CONSTAT DATÉ : il vieillirait
 * en silence, et le jour où l'horoscope arriverait derrière un gate premium, aucun test ne bougerait.
 *
 * L'inventaire porte donc les items ABSENTS avec leur détecteur. Le jour où l'un d'eux apparaît dans le
 * code, CE FICHIER ROUGIT — non pas parce que quelque chose est cassé, mais parce qu'il exige qu'on
 * l'inscrive et qu'on prouve alors qu'aucun chemin premium ne le garde. C'est ce qui transforme AC4 en
 * promesse durable au lieu d'un instantané.
 */

const racine = process.cwd();

function fichiersSource(dir: string): string[] {
  if (!existsSync(resolve(racine, dir))) return [];
  return (readdirSync(resolve(racine, dir), { recursive: true, encoding: "utf-8" }) as string[])
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => `${dir}/${f}`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// L'INVENTAIRE FR-055 — les huit items du gratuit à vie, présents ET à venir
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
interface ItemSocle {
  readonly item: string;
  /** Existe-t-il aujourd'hui ? Un `false` qui devient vrai DOIT rougir (T6-2). */
  readonly existe: boolean;
  /** Ce qui trahirait son apparition dans l'arborescence (chemin de fichier). */
  readonly detecteur: RegExp;
}

const FR055: readonly ItemSocle[] = [
  { item: "la première séance intégrale, jusqu'au bilan", existe: true, detecteur: /seance|bilan/i },
  { item: "les ressources d'aide (FR-077)", existe: true, detecteur: /[/\\]aide[/\\]/i },
  { item: "le tronc de l'arbre", existe: true, detecteur: /[/\\]arbre[/\\]/i },
  { item: "la lecture de tout ce qu'elle a déjà écrit", existe: true, detecteur: /projection-arbre|depot-branche/i },
  // ── Epic 5 : ce qui reste ci-dessous n'existe pas. Le jour où ça existe, ce fichier le dit. ──
  // ⚠️ ARRIVÉE LE 2026-08-07 (Story 5.2). Deuxième rougissement de ce filet, deuxième honoré.
  { item: "numérologie complète", existe: true, detecteur: /numerolog|numérolog/i },
  // ⚠️ ARRIVÉ LE 2026-08-07 (Story 5.1). Ce filet a rougi exactement comme il avait été armé pour
  // le faire, et il exige maintenant la preuve positive ci-dessous : aucun gate premium sur le socle.
  { item: "thème natal", existe: true, detecteur: /theme-natal|theme_natal|natal/i },
  // ⚠️ ARRIVÉS LE 2026-08-11 (Story 5.4). Troisième et quatrième rougissement de ce filet, honorés
  // comme les précédents — avec la preuve positive ci-dessous.
  { item: "horoscope quotidien", existe: true, detecteur: /horoscope/i },
  { item: "mantra du jour", existe: true, detecteur: /mantra/i },
  // ⚠️ ARRIVÉ LE 2026-08-13 (Story 5.5). Cinquième rougissement de ce filet, honoré comme les
  // quatre précédents — avec la preuve positive plus bas, commentaires compris.
  { item: "test d'ennéagramme", existe: true, detecteur: /enneagramme|ennéagramme/i },
];

describe("[T6-2] LE FILET POUR L'EPIC 5 — l'inventaire vieillit en rougissant, pas en silence", () => {
  const corpus = [...fichiersSource("app"), ...fichiersSource("render"), ...fichiersSource("lib")];

  it("[NON-VACUITÉ] le corpus balayé est réel, et les détecteurs mordent vraiment", () => {
    // ⚠️ Sans ces deux preuves, « aucun item Epic 5 n'est apparu » serait vrai parce qu'on ne
    // regarde rien, ou parce que les expressions ne matchent jamais. Le mode d'échec silencieux
    // classique d'un inventaire prospectif.
    expect(corpus.length, "corpus vide — le filet ne balaie rien").toBeGreaterThan(50);
    // Chaque détecteur d'item À VENIR est prouvé sur un chemin FABRIQUÉ : le jour où le vrai
    // fichier arrivera, on sait déjà que l'expression l'attrapera.
    const fabriques: Record<string, string> = {
      "horoscope quotidien": "app/api/horoscope/route.ts",
      "mantra du jour": "render/socle/MantraDuJour.tsx",
      // « test d'ennéagramme » n'a plus de chemin fabriqué : l'item EXISTE depuis la 5.5, et son
      // détecteur est exercé sur les vrais fichiers par le bloc `existe: true` ci-dessous.
    };
    for (const it of FR055.filter((i) => !i.existe)) {
      // ⚠️ Un item À VENIR sans chemin fabriqué donnait `fabriques[…] === undefined`, que
      // `RegExp.test` convertit en la CHAÎNE « undefined » — un détecteur pouvait donc être
      // certifié par un mot qui n'est pas un chemin. On exige le témoin explicitement.
      expect(fabriques[it.item], `aucun chemin fabriqué pour l'item à venir « ${it.item} »`).toBeTypeOf(
        "string",
      );
      expect(it.detecteur.test(fabriques[it.item]), `détecteur inopérant pour « ${it.item} »`).toBe(true);
    }
  });

  /**
   * E2 (revue du 2026-08-12) — L'AUTRE MOITIÉ DE L'INVENTAIRE N'ÉTAIT PAS ÉPROUVÉE.
   *
   * Le test ci-dessus ne certifiait que les items `existe: false`. Les cinq marqués `existe: true`
   * ne voyaient jamais leur détecteur exercé : rien ne vérifiait que « ça existe » soit VRAI.
   *
   * Ce n'est pas une coquetterie. Le filet fonctionne par bascule : un item apparaît, `LE CŒUR`
   * rougit, on le passe à `existe: true` et on écrit sa preuve de non-gate. Si le détecteur d'un
   * item déjà basculé était cassé, le filet resterait vert pour la seule raison qu'il ne trouve
   * plus rien — et le jour où quelqu'un déplacerait ce socle derrière un mur payant, personne ne
   * le saurait. Un inventaire dont la moitié des lignes ne sont pas vérifiables est un inventaire.
   */
  it("[E2] chaque item déclaré EXISTANT a bien des fichiers dans le dépôt", () => {
    for (const it of FR055.filter((i) => i.existe)) {
      const trouves = corpus.filter((f) => it.detecteur.test(f));
      expect(
        trouves.length,
        `FR-055 « ${it.item} » est marqué existant, et son détecteur ne trouve RIEN. ` +
          `Soit le socle a disparu, soit le détecteur est cassé — dans les deux cas ce filet ment.`,
      ).toBeGreaterThan(0);
    }
  });

  it("[LE CŒUR] aucun item FR-055 n'est apparu sans être inscrit dans l'inventaire", () => {
    // Mutation-cible : créer `app/(scene)/horoscope/page.tsx`. Ce test rougit, et son message dit quoi
    // faire : inscrire l'item (`existe: true`) ET prouver ci-dessous qu'aucun chemin premium ne le garde.
    for (const it of FR055.filter((i) => !i.existe)) {
      const apparus = corpus.filter((f) => it.detecteur.test(f));
      expect(
        apparus,
        `FR-055 « ${it.item} » vient d'apparaître (${apparus.join(", ")}). ` +
          `Passe-le à \`existe: true\` dans cet inventaire ET prouve qu'aucun gate premium ne le garde — ` +
          `c'est du GRATUIT À VIE, pas une fonctionnalité de plus.`,
      ).toEqual([]);
    }
    console.info(
      `[socle-jamais-coupe] ${corpus.length} fichiers balayés, ` +
        `${FR055.filter((i) => i.existe).length}/${FR055.length} items FR-055 existants, ` +
        `${FR055.filter((i) => !i.existe).length} en veille pour l'Epic 5.`,
    );
  });
});

describe("[T6-1 / AC4] les items FR-055 qui EXISTENT : aucun chemin premium ne les garde", () => {
  it("la PREMIÈRE SÉANCE n'est jamais coupée, quelle que soit la consommation", () => {
    // Mutation-cible : retirer `if (!e.seanceClose) return false` de `doitCouperConversation`.
    const enSeance = { premium: false, limitesLevees: false, seanceClose: false, toursConsommes: 9999, limite: 1 };
    expect(doitCouperConversation(enSeance), "FR-059 : la 1ʳᵉ séance est intégrale").toBe(false);
    // …et le CONTRÔLE POSITIF : une fois la séance close, la limite s'applique bien (sinon le test
    // ci-dessus serait satisfait par une fonction qui ne coupe JAMAIS rien).
    expect(doitCouperConversation({ ...enSeance, seanceClose: true })).toBe(true);
  });

  it("[FR-055 / Story 5.5 / DUR] le TEST D'ENNÉAGRAMME n'est gardé par aucun chemin premium", () => {
    /*
     * La seconde moitié du contrat de ce filet, celle qu'on oublie : basculer `existe: true` ne
     * prouve RIEN tout seul. La 5.2 puis la 5.4 se sont fait prendre chacune une fois — et pas sur
     * du code, sur des COMMENTAIRES qui citaient le registre de la facturation. Le balayage ne
     * retire donc pas les commentaires : ce qu'on explique compte autant que ce qu'on exécute,
     * parce qu'une explication qui parle d'abonnement est le premier pas vers un `if`.
     *
     * L'ennéagramme est un cas plus net encore que les précédents : il ne dérive d'AUCUNE donnée de
     * naissance. Un socle illisible, un thème absent, une heure manquante ne doivent en aucun cas
     * le rendre indisponible — c'est la faute B4 que la revue du 2026-08-12 a trouvée sur le mantra
     * (« le gratuit à vie tombait avec le thème »).
     */
    const chemins = [...fichiersSource("app"), ...fichiersSource("render"), ...fichiersSource("lib")].filter((c) =>
      /enneagramme|ennéagramme/i.test(c),
    );
    // PRÉSENCE D'ABORD — sans témoin, ce test réussirait sur une liste vide, ce qui est exactement
    // le mode d'échec qu'une garde d'absence produit quand son extracteur casse.
    expect(chemins.length, "aucun fichier d'ennéagramme balayé — la garde ne regarde rien").toBeGreaterThan(0);
    for (const chemin of chemins) {
      const source = readFileSync(resolve(racine, chemin), "utf-8");
      for (const interdit of [/premium/i, /abonnement/i, /entitlement/i, /planOuvert/, /GardeCommerciale/, /stripe/i]) {
        expect(source, `${chemin} : le socle gratuit s'est mis à parler de commerce (${interdit})`).not.toMatch(
          interdit,
        );
      }
    }
  });

  it("les RESSOURCES D'AIDE (FR-077) ne lisent ni session, ni abonnement, ni garde commerciale", () => {
    // La page est publique et statique par contrat (AD-9/AD-15/NFR-002 : le filet ne dépend de rien).
    // PRÉSENCE D'ABORD : on prouve qu'on lit bien la page d'aide et qu'elle rend les ressources.
    const src = readFileSync(resolve(racine, "app/aide/page.tsx"), "utf-8");
    expect(src, "témoin : la page sert bien les ressources d'aide").toMatch(/RESSOURCES_AIDE/);
    expect(src, "témoin : et la sortie rapide FR-074").toMatch(/SortieRapide/);
    for (const interdit of [/getUser|auth\./, /abonnement/i, /premium/i, /GardeCommerciale/, /redirect\(/]) {
      expect(src, `le filet de sécurité s'est mis à dépendre de quelque chose : ${interdit}`).not.toMatch(interdit);
    }
  });

  it("[LE CŒUR / FR-088] le TRONC est servi sur le chemin NOMINAL d'un compte gratuit", async () => {
    // ⚠️ LA PREMIÈRE VERSION DE CE TEST PASSAIT POUR UNE MAUVAISE RAISON, et c'est instructif : son
    // client factice répondait `data: false` à TOUTES les RPC. `chargerBranches` faisait donc
    // `false.map(...)`, levait, et le `catch` rendait `ARBRE_INDISPONIBLE` — qui porte lui aussi
    // `tronc: { present: true }`. Le test était vert en n'ayant jamais exécuté une seule ligne du
    // chemin qu'il prétendait garder. Exactement le mode d'échec que cette story traque partout ailleurs.
    //
    // Le client répond donc PAR RPC, et l'assertion `indisponible` est ce qui prouve qu'on est bien
    // sur le chemin nominal. Mutation-cible : conditionner `tronc: { present: true }` à quoi que ce soit.
    const compteGratuit = {
      rpc: async (nom: string) => {
        if (nom === "charger_branches_arbre") return { data: [], error: null };
        return { data: false, error: null }; // ni premium, ni fenêtre de détresse
      },
    } as unknown as SupabaseClient;
    const p = await chargerProjectionArbre(compteGratuit, "11111111-1111-4111-8111-111111111111");
    expect(p.indisponible, "témoin : on a bien pris le chemin NOMINAL, pas le repli").toBeUndefined();
    expect(p.planOuvert, "témoin : ce compte n'est PAS premium (sinon le test ne prouverait rien)").toBeUndefined();
    expect(p.gestesSuspendus, "témoin : ni en détresse").toBeUndefined();
    expect(p.tronc.present, "le tronc est gratuit — il ne se négocie pas").toBe(true);
  });

  it("[FR-055 / Story 5.3 / DUR] la MENTION DE COMPLÉTION n'est pas derrière le gate premium", async () => {
    /*
     * ⚠️ LA GARDE LA PLUS FRAGILE DE LA STORY 5.3, parce qu'elle protège un ORDRE.
     *
     * `chargerOuverture` ouvre sur `if (!premiumSousJwt(...)) return null` depuis la 3.3 : sur un
     * compte gratuit, Anam ne propose plus de branche. La mention de complétion du socle est
     * évaluée AVANT cette ligne — et le réflexe d'harmonisation (« toutes les ouvertures passent
     * par le même gate ») la ferait descendre dessous en une seconde, sans rien casser d'apparent.
     *
     * Ce serait pourtant une COUPURE DU SOCLE GRATUIT : le socle est gratuit à vie (FR-055), le
     * tronc est gratuit (FR-088), et une utilisatrice gratuite qui vient d'aller chercher son acte
     * de naissance à la mairie n'entendrait jamais qu'Anam a bien reçu son heure.
     *
     * On l'éprouve par le COMPORTEMENT, pas par la lecture du source : un compte explicitement NON
     * premium doit quand même recevoir la mention.
     */
    const { chargerOuverture } = await import("@/lib/safety/ouverture-branche");
    const appels: string[] = [];
    const compteGratuit = {
      rpc: async (nom: string) => {
        appels.push(nom);
        // `annonce_socle_due` dit oui ; TOUT le reste dit non — en particulier
        // l'entitlement premium (`premium_actif`), qui doit rester sans effet sur cette mention.
        if (nom === "annonce_socle_due") return { data: true, error: null };
        return { data: false, error: null };
      },
    } as unknown as SupabaseClient;

    const o = await chargerOuverture(compteGratuit, "11111111-1111-1111-1111-111111111111");
    expect(
      o,
      "un compte GRATUIT n'a pas entendu la mention — le gate premium est repassé devant",
    ).toEqual({ type: "socle-complete", phrase: expect.any(String) });
    // Témoin : la réservation a bien été TENTÉE avant tout le reste (sinon l'assertion ci-dessus
    // pourrait être satisfaite par un chemin qui ne passe pas par là).
    expect(appels[0]).toBe("annonce_socle_due");
  });

  it("[FR-055 / Story 5.5 / DUR] L'HYPOTHÈSE D'ANAM n'est pas derrière le gate premium", async () => {
    /*
     * ⚠️ LA MÊME GARDE FRAGILE QUE CI-DESSUS, POUR LA MÊME RAISON — et l'en-tête d'
     * `ouverture-branche.ts` PROMET qu'elle existe ici. Une garde qui ne vit que dans un
     * commentaire n'existe pas : c'est la doctrine que cette story a payée en T1.
     *
     * L'ennéagramme est du socle GRATUIT À VIE (FR-055). Déplacer le bloc sous `premiumSousJwt`
     * prend une seconde, ne casse rien d'apparent, et rend Anam muette sur un compte gratuit —
     * alors même que le germe est écrit en base et que la halte, elle, resterait accessible.
     *
     * Éprouvée par le COMPORTEMENT : un compte explicitement NON premium doit recevoir l'ouverture.
     */
    vi.resetModules();
    vi.doMock("@/lib/data/lire-enneagramme", () => ({
      lireHypotheseEnneagramme: async () => ({
        statut: "calcule",
        hypothese: { id: "h-1", type: 4, aDire: true },
      }),
    }));
    try {
      const { chargerOuverture } = await import("@/lib/safety/ouverture-branche");
      const compteGratuit = {
        rpc: async () => ({ data: false, error: null }), // ni premium, ni mention de socle due
      } as unknown as SupabaseClient;
      const o = await chargerOuverture(compteGratuit, "11111111-1111-1111-1111-111111111111");
      expect(
        o?.type,
        "un compte GRATUIT n'a pas entendu l'hypothèse — le gate premium est repassé devant",
      ).toBe("hypothese-enneagramme");
    } finally {
      vi.doUnmock("@/lib/data/lire-enneagramme");
      vi.resetModules();
    }
  });

  it("[FR-055 / Story 5.1] le THÈME NATAL n'est gardé par AUCUN chemin premium", () => {
    // Le socle calculé est GRATUIT À VIE (FR-055/FR-088 : « le tronc est gratuit »). Il ne dépend
    // donc d'aucun entitlement — la seule garde qui pèse sur lui est celle du consentement art. 9
    // (AD-13), qui est une garde LÉGALE et non commerciale. Les confondre serait faire payer une
    // conformité.
    const socle = [
      "lib/astro/theme-natal.ts",
      "lib/astro/port.ts",
      "lib/astro/adapters/astronomy-engine.ts",
      "lib/data/depot-theme-natal.ts",
    ];
    // PRÉSENCE D'ABORD : on prouve qu'on lit bien les fichiers du socle et qu'ils calculent bien
    // le thème — sans quoi « aucun mot premium » serait vrai d'un fichier vide ou inexistant.
    const sources = socle.map((f) => {
      const chemin = resolve(racine, f);
      expect(existsSync(chemin), `fichier de socle introuvable : ${f}`).toBe(true);
      return { f, src: readFileSync(chemin, "utf-8") };
    });
    expect(sources.some((s) => /calculerThemeNatal/.test(s.src)), "témoin : le socle calcule bien").toBe(true);
    expect(sources.some((s) => /a_consenti_art9|theme_natal/.test(s.src)), "témoin : il persiste bien").toBe(true);

    for (const { f, src } of sources) {
      for (const gate of [/premium/i, /abonnement/i, /entitlement/i, /planOuvert/, /GardeCommerciale/, /stripe/i]) {
        expect(src, `garde COMMERCIALE sur le socle gratuit dans ${f} : ${gate}`).not.toMatch(gate);
      }
    }
  });

  it("[FR-055 / Story 5.4] le SOCLE QUOTIDIEN n'est gardé par AUCUN chemin premium", () => {
    // « Horoscope quotidien » et « mantra du jour » sont deux items distincts de FR-055 — et le
    // mantra est celui qui coûte le moins cher du produit entier : une rotation modulo sur une date.
    // Le garder derrière un abonnement serait faire payer une soustraction.
    //
    // ⚠️ FR-080 vit ici aussi : le mantra du jour est GRATUIT, l'ancrage est premium. Ce sont deux
    // choses différentes, et les confondre ferait basculer le mantra du mauvais côté de la
    // frontière commerciale — la faute exacte que FR-080 nomme.
    const socle = [
      "lib/astro/quotidien.ts",
      "lib/corpus/mantra.ts",
      "lib/corpus/horoscope.ts",
      "lib/data/lire-quotidien.ts",
    ];
    const sources = socle.map((f) => {
      const chemin = resolve(racine, f);
      expect(existsSync(chemin), `fichier de socle introuvable : ${f}`).toBe(true);
      return { f, src: readFileSync(chemin, "utf-8") };
    });
    // PRÉSENCE D'ABORD : on prouve qu'on lit bien des fichiers qui calculent et servent vraiment le
    // socle quotidien — sans quoi « aucun mot premium » serait vrai d'un fichier vide.
    expect(sources.some((s) => /horoscopeDuJour/.test(s.src)), "témoin : l'horoscope est calculé").toBe(true);
    expect(sources.some((s) => /mantraDuJour/.test(s.src)), "témoin : le mantra est servi").toBe(true);
    expect(sources.some((s) => /CORPUS_MANTRA/.test(s.src)), "témoin : le corpus est branché").toBe(true);

    for (const { f, src } of sources) {
      for (const gate of [/premium/i, /abonnement/i, /entitlement/i, /planOuvert/, /GardeCommerciale/, /stripe/i]) {
        expect(src, `garde COMMERCIALE sur le socle gratuit dans ${f} : ${gate}`).not.toMatch(gate);
      }
    }
  });

  it("[FR-055 / Story 5.6] les CINQ cartes du socle survivent à un compte gratuit", () => {
    // ⚠️ POURQUOI CETTE GARDE EST COMPORTEMENTALE ET NON LEXICALE. `lib/data/lire-bibliotheque.ts`
    // ne peut PAS entrer dans les listes « aucun mot premium » ci-dessus : il porte `aPremium`, et
    // légitimement — la bibliothèque est le contenant, et elle accueillera des cartes payantes en
    // 5.8 (la lecture) et 5.9 (l'ancrage).
    //
    // Refuser le mot serait donc impossible ; refuser le RÉSULTAT ne l'est pas. On construit les
    // cinq VRAIES cartes du socle — pas des doublures — et on vérifie qu'un compte gratuit les
    // garde toutes. C'est plus fort que le balayage : ça interdit la conséquence, pas le vocabulaire.
    const socle = [
      carteMantra(NON_ECRIT),
      carteHoroscope(null),
      carteTheme(null),
      carteNombres(null),
      carteEnneagramme(null, NON_ECRIT),
    ];
    expect(socle, "témoin : les cinq cartes du socle sont bien construites").toHaveLength(5);

    const gratuite = cartesDisponibles(socle, false);
    expect(
      gratuite.map((c) => c.cle).sort(),
      "une carte du socle a disparu pour un compte gratuit — FR-055",
    ).toEqual(["enneagramme", "horoscope", "mantra", "nombres", "theme"]);

    // Et l'entitlement n'AJOUTE rien non plus : le socle est le même des deux côtés du paywall.
    expect(cartesDisponibles(socle, true).map((c) => c.cle).sort()).toEqual(
      gratuite.map((c) => c.cle).sort(),
    );
  });

  it("[FR-055 / Story 5.2] la NUMÉROLOGIE n'est gardée par AUCUN chemin premium", () => {
    // « Numérologie complète » est le PREMIER item de FR-055 et le socle le moins cher du produit :
    // de l'arithmétique sur une date et un nom. Le garder derrière un abonnement serait faire payer
    // ce qui ne coûte rien — exactement l'inverse de la frontière voulue (le coût est l'IA, pas le
    // calcul). Ici la seule contrainte est l'absence de nom, qui est une ABSENCE DE DONNÉE, jamais
    // une garde commerciale.
    const socle = [
      "lib/astro/numerologie.ts",
      "lib/corpus/port.ts",
      "lib/corpus/numerologie.ts",
      "lib/data/lire-numerologie.ts",
    ];
    // PRÉSENCE D'ABORD : on prouve qu'on lit bien des fichiers qui calculent et servent vraiment la
    // numérologie — sans quoi « aucun mot premium » serait vrai d'un fichier vide ou inexistant.
    const sources = socle.map((f) => {
      const chemin = resolve(racine, f);
      expect(existsSync(chemin), `fichier de socle introuvable : ${f}`).toBe(true);
      return { f, src: readFileSync(chemin, "utf-8") };
    });
    expect(sources.some((s) => /calculerNumerologie/.test(s.src)), "témoin : le socle calcule bien").toBe(true);
    expect(sources.some((s) => /cheminDeVie/.test(s.src)), "témoin : le chemin de vie est bien là").toBe(true);
    expect(sources.some((s) => /CORPUS_NUMEROLOGIE/.test(s.src)), "témoin : le corpus est bien branché").toBe(true);

    for (const { f, src } of sources) {
      for (const gate of [/premium/i, /abonnement/i, /entitlement/i, /planOuvert/, /GardeCommerciale/, /stripe/i]) {
        expect(src, `garde COMMERCIALE sur le socle gratuit dans ${f} : ${gate}`).not.toMatch(gate);
      }
    }
  });

  it("même une PANNE totale de lecture laisse le tronc debout (repli sûr AD-15)", async () => {
    const quiLeve = {
      rpc: async () => {
        throw new Error("42501");
      },
    } as unknown as SupabaseClient;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const p = await chargerProjectionArbre(quiLeve, "11111111-1111-4111-8111-111111111111");
    expect(p.tronc.present).toBe(true);
    spy.mockRestore();
  });
});

describe("[T6-3 / AC5 / FR-058] l'allocation s'épuise : coupée, mais jamais à zéro", () => {
  afterEach(() => {
    delete process.env.ALLOCATION_RESIDUELLE_TOURS;
  });

  it("[D4-A] la limite n'est PAS posée en production — la conversation gratuite est illimitée aujourd'hui", () => {
    // Ce n'est pas un trou, c'est la porte ops voulue par la 3.4 : `null` = jamais coupé à zéro.
    // Le jour où le lancement pose une valeur, ce test dira qu'une décision a été prise — et c'est
    // exactement le moment où quelqu'un doit relire AC5.
    expect(process.env.ALLOCATION_RESIDUELLE_TOURS, "posée en environnement — décision de lancement ?").toBeUndefined();
    expect(limiteAllocationResiduelle()).toBeNull();
  });

  it("[LE CŒUR] limite POSÉE (dans ce test seul) → la conversation coupe VRAIMENT", () => {
    // AC5 doit être exerçable sans rien poser en production. On la pose ici, on prouve la coupure,
    // et le bloc suivant prouve que le socle, lui, ne bouge pas.
    process.env.ALLOCATION_RESIDUELLE_TOURS = "3";
    expect(limiteAllocationResiduelle()).toBe(3);
    const e = { premium: false, limitesLevees: false, seanceClose: true, toursConsommes: 3, limite: 3 };
    expect(doitCouperConversation(e), "à la limite, ça coupe").toBe(true);
    expect(doitCouperConversation({ ...e, toursConsommes: 2 }), "en dessous, ça passe").toBe(false);
  });

  it("…et LA DÉTRESSE lève la coupure, toujours (AD-9/AD-17 : aucun commerce sur la sécurité)", () => {
    process.env.ALLOCATION_RESIDUELLE_TOURS = "3";
    const e = { premium: false, limitesLevees: true, seanceClose: true, toursConsommes: 99, limite: 3 };
    expect(doitCouperConversation(e)).toBe(false);
  });

  it("[AC5] la copie de l'épuisement n'APPÂTE pas — et elle dit que le socle reste ouvert", () => {
    // Déjà gardé côté 3.4 ; re-prouvé ICI du côté du SOCLE, parce que c'est le socle que la phrase
    // promet. Une copie qui se mettrait à vendre serait la trahison exacte de FR-058.
    // PRÉSENCE D'ABORD : la phrase parle bien de l'arrêt de l'échange et de ce qui reste.
    expect(LIGNE_QUOTA_EPUISEE, "témoin : elle annonce bien l'arrêt").toMatch(/s.arrête ici/);
    expect(LIGNE_QUOTA_EPUISEE, "témoin : et elle promet le socle").toMatch(/reste ouvert/);
    for (const appat of [/premium/i, /abonn/i, /débloqu|debloqu/i, /\d+\s*€|€\s*\d+/, /offre/i, /upgrade/i]) {
      expect(LIGNE_QUOTA_EPUISEE, `appât dans la copie d'épuisement : ${appat}`).not.toMatch(appat);
    }
  });

  it("[AC5] les surfaces du socle restent ATTEIGNABLES : elles ne lisent pas l'allocation", () => {
    // Une coupure de conversation ne doit toucher AUCUNE des surfaces du socle. La preuve la plus
    // simple et la plus durable : aucune d'elles ne connaît la notion.
    const surfaces = [
      "app/aide/page.tsx",
      "render/arbre/ArbreInteractif.tsx",
      "render/arbre/FicheBranche.tsx",
      "render/arbre/VueListe.tsx",
      "render/arbre/EtatVideArbre.tsx",
    ];
    for (const f of surfaces) {
      expect(existsSync(resolve(racine, f)), `surface du socle introuvable : ${f}`).toBe(true);
      const src = readFileSync(resolve(racine, f), "utf-8");
      for (const interdit of [/ALLOCATION_RESIDUELLE/, /doitCouperConversation/, /toursConsommes/]) {
        expect(src, `${f} s'est mis à dépendre de l'allocation — le socle serait coupable`).not.toMatch(interdit);
      }
    }
    expect(surfaces.length, "inventaire de surfaces vide").toBeGreaterThan(3);
  });
});
