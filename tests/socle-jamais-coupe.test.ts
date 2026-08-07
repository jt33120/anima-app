import { describe, it, expect, vi, afterEach } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { doitCouperConversation } from "@/lib/domain/allocation-residuelle";
import { limiteAllocationResiduelle } from "@/lib/ai/allocation-config";
import { LIGNE_QUOTA_EPUISEE } from "@/render/conversation/ligne-quota";
import { chargerProjectionArbre } from "@/lib/safety/projection-arbre";

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
  // ── Epic 5 : rien de tout cela n'existe. Le jour où ça existe, ce fichier le dit. ──
  { item: "numérologie complète", existe: false, detecteur: /numerolog|numérolog/i },
  { item: "thème natal", existe: false, detecteur: /theme-natal|theme_natal|natal/i },
  { item: "horoscope quotidien", existe: false, detecteur: /horoscope/i },
  { item: "mantra du jour", existe: false, detecteur: /mantra/i },
  { item: "test d'ennéagramme", existe: false, detecteur: /enneagramme|ennéagramme/i },
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
      "numérologie complète": "app/(scene)/numerologie/page.tsx",
      "thème natal": "lib/socle/theme-natal.ts",
      "horoscope quotidien": "app/api/horoscope/route.ts",
      "mantra du jour": "render/socle/MantraDuJour.tsx",
      "test d'ennéagramme": "app/(scene)/enneagramme/page.tsx",
    };
    for (const it of FR055.filter((i) => !i.existe)) {
      expect(it.detecteur.test(fabriques[it.item]), `détecteur inopérant pour « ${it.item} »`).toBe(true);
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
    const p = await chargerProjectionArbre(compteGratuit);
    expect(p.indisponible, "témoin : on a bien pris le chemin NOMINAL, pas le repli").toBeUndefined();
    expect(p.planOuvert, "témoin : ce compte n'est PAS premium (sinon le test ne prouverait rien)").toBeUndefined();
    expect(p.gestesSuspendus, "témoin : ni en détresse").toBeUndefined();
    expect(p.tronc.present, "le tronc est gratuit — il ne se négocie pas").toBe(true);
  });

  it("même une PANNE totale de lecture laisse le tronc debout (repli sûr AD-15)", async () => {
    const quiLeve = {
      rpc: async () => {
        throw new Error("42501");
      },
    } as unknown as SupabaseClient;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const p = await chargerProjectionArbre(quiLeve);
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
