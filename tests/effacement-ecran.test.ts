import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as copie from "@/lib/domain/copie-mes-donnees";
import {
  FENETRE_PITR_JOURS_DEFAUT,
  FENETRE_PITR_JOURS_MAX,
  fenetreDepuisTexte,
  fenetreRecevable,
} from "@/lib/domain/effacement";
import { effacerToutesSesDonnees } from "@/lib/data/effacer-donnees";

/**
 * effacement-ecran.test.ts — LA CONFIRMATION UNIQUE, ET RIEN AUTOUR (Story 6.7, AC3/AC5).
 *
 * L'AC3 est une exigence NÉGATIVE : « aucun écran de rétention, aucune offre, aucun "es-tu sûre ?"
 * à étages ». On ne prouve pas une absence en regardant une page — on la garde en refusant que le
 * vocabulaire et les mécanismes de la retenue puissent apparaître sur ce chemin.
 */

const racine = process.cwd();

/**
 * ⚠️ LES COMMENTAIRES SONT RETIRÉS, ET TROIS TESTS ROUGES ONT DÛ ME L'IMPOSER. Sans ça, une garde
 * qui interdit `process.env` dans le domaine rougissait sur la PHRASE qui explique qu'il n'y en a
 * pas, et une garde qui interdit un mécanisme de confirmation rougissait sur `etapeOnboardingPour`.
 * Une garde qui matche sa propre prose finit toujours par être desserrée pour la faire taire.
 */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const lire = (f: string) => sansCommentaires(readFileSync(resolve(racine, f), "utf-8"));
const PAGE = lire("app/mes-donnees/page.tsx");
const ACTION = lire("app/mes-donnees/actions.ts");

describe("[6.7/AC3] Un export est proposé AVANT la suppression", () => {
  it("[LE CŒUR] le lien d'export précède le formulaire d'effacement dans la page", () => {
    // L'AC3 le demande mot pour mot. Une garde sur l'ORDRE de la source est la seule façon qu'un
    // remaniement ne le retourne pas sans que personne ne le voie.
    const exportLink = PAGE.indexOf('href="/api/export"');
    const formulaire = PAGE.indexOf("action={effacerTout}");
    expect(exportLink).toBeGreaterThan(-1);
    expect(formulaire).toBeGreaterThan(-1);
    expect(exportLink, "l'effacement passe avant l'export").toBeLessThan(formulaire);
  });

  it("et la copie de l'effacement y renvoie explicitement", () => {
    expect(copie.EFFACEMENT_EXPORT_DABORD).toMatch(/télécharge|au-dessus/i);
  });
});

describe("[6.7/AC3] UNE confirmation, sur le même écran, et pas une de plus", () => {
  it("[LE CŒUR] une seule case, un seul bouton, un seul formulaire", () => {
    expect((PAGE.match(/type="checkbox"/g) ?? []).length, "plus d'une case à cocher").toBe(1);
    expect((PAGE.match(/type="submit"/g) ?? []).length, "plus d'un bouton d'envoi").toBe(1);
    expect((PAGE.match(/action=\{effacerTout\}/g) ?? []).length).toBe(1);
  });

  it("[LE CŒUR] AUCUN écran ne s'interpose : pas de page intermédiaire, pas de deuxième étape", () => {
    // Un « es-tu sûre ? » à étages prendrait deux formes possibles : une ROUTE de confirmation, ou
    // un ÉTAT de page qui attend un second geste. On interdit les deux — la première en exigeant
    // que la halte ne contienne aucune sous-route, la seconde en interdisant tout état client.
    const fichiers = readdirSync(resolve(racine, "app/mes-donnees"), { recursive: true, encoding: "utf-8" });
    expect([...fichiers].sort(), `la halte a gagné une sous-route : ${fichiers.join(", ")}`).toEqual([
      "actions.ts",
      "page.tsx",
    ]);
    expect(PAGE, "un état d'attente est apparu sur la page").not.toMatch(/useState|"use client"/);
    expect(ACTION, "l'action renvoie vers un écran de confirmation").not.toMatch(
      /redirect\("\/mes-donnees\/[^"]*"/,
    );
  });

  it("la case est vérifiée côté SERVEUR aussi — un formulaire se poste sans navigateur", () => {
    expect(PAGE).toMatch(/required/);
    expect(ACTION).toMatch(/donnees\.get\("compris"\)\s*!==\s*"oui"/);
  });
});

describe("[6.7/AC3] Les mots de l'effacement ne retiennent rien", () => {
  const CHEMIN = [
    copie.SECTION_EFFACEMENT,
    copie.EFFACEMENT_CE_QUI_PART,
    copie.EFFACEMENT_CE_QUI_RESTE_PREFIXE,
    copie.EFFACEMENT_EXPORT_DABORD,
    copie.EFFACEMENT_CONFIRMATION,
    copie.ACTION_EFFACER,
    copie.ADIEU,
    copie.effacementFenetre(7),
  ].join(" • ");

  const RETENUE: readonly [string, RegExp][] = [
    ["une question posée avant d'effacer", /pourquoi|dis-nous|peux-tu nous dire/i],
    ["une offre de dernière minute", /offre|gratuit|réduction|essaie|un mois de plus|au lieu de/i],
    ["un « es-tu sûre » de plus", /es-tu s[ûu]re|vraiment s[ûu]re|réfléchi/i],
    ["une retenue affective", /tu vas nous manquer|dommage|regrett|reviens/i],
    ["une alternative pour ne pas partir", /plut[ôo]t que de|si tu pr[ée]f[èe]res|tu peux aussi (mettre en pause|suspendre)/i],
  ];

  for (const [nom, motif] of RETENUE) {
    it(`aucune trace de : ${nom}`, () => {
      expect(motif.test(CHEMIN), `« ${motif.source} » apparaît sur le chemin d'effacement`).toBe(false);
    });
  }

  it("[ANTI-VACUITÉ] les cinq motifs MORDENT sur la copie tentante qu'on aurait pu écrire", () => {
    const tentant =
      "Es-tu sûre ? Dis-nous pourquoi tu pars. Plutôt que de tout effacer, tu peux aussi mettre en " +
      "pause — et on t'offre un mois gratuit. Tu vas nous manquer, reviens quand tu veux.";
    for (const [nom, motif] of RETENUE) {
      expect(motif.test(tentant), `le motif « ${nom} » ne mord sur rien`).toBe(true);
    }
  });

  it("la copie DIT ce qui part, et qu'il n'y a pas de retour", () => {
    expect(copie.EFFACEMENT_CE_QUI_PART).toMatch(/rien ne revient/i);
    expect(copie.EFFACEMENT_CONFIRMATION).toMatch(/rien ne revient/i);
  });

  it("l'adieu est en registre PRODUIT — Anam n'a plus rien à lui dire", () => {
    const entrer = lire("app/(auth)/entrer/page.tsx");
    expect(entrer).toMatch(/efface === "1"/);
    // La classe `t-anam` est la voix d'Anam. Faire parler Anam après un effacement serait la
    // dernière tentative de retenir quelqu'un qui vient de tout retirer.
    expect(entrer, "l'adieu est signé d'Anam").not.toMatch(/t-anam"[\s\S]{0,120}\{ADIEU\}/);
    expect(entrer).toMatch(/t-meta"[^>]*>\s*\{ADIEU\}/);
  });
});

describe("[6.7/AC5] Un échec ne prétend JAMAIS que c'est fait", () => {
  it("[LE CŒUR] l'action renvoie sur la halte avec un motif, elle ne dit pas adieu", () => {
    // Un écran d'adieu affiché sur un effacement qui a échoué serait le pire mensonge que ce
    // produit puisse dire : elle repartirait en croyant avoir tout retiré.
    expect(ACTION).toMatch(/catch[\s\S]{0,300}redirect\("\/mes-donnees\?echec=effacement"\)/);
    expect(ACTION).toMatch(/journaliserIncidentSecurite/);
    const echec = ACTION.indexOf('echec=effacement');
    const adieu = ACTION.indexOf('/entrer?efface=1');
    expect(echec, "l'adieu est prononcé avant que l'échec ne soit traité").toBeLessThan(adieu);
  });

  it("la déconnexion est LOCALE — l'identité d'auth n'existe plus, la demander échouerait", () => {
    expect(ACTION).toMatch(/signOut\(\{\s*scope:\s*"local"\s*\}\)/);
  });
});

describe("[6.7/AD-14] La fenêtre est un paramètre lu à l'exécution", () => {
  it("le domaine ne lit AUCUN environnement (AD-1)", () => {
    expect(lire("lib/domain/effacement.ts")).not.toMatch(/process\.env/);
  });

  it("recevable : un entier de 0 à 35, et rien d'autre", () => {
    expect(fenetreRecevable(0)).toBe(true);
    expect(fenetreRecevable(FENETRE_PITR_JOURS_MAX)).toBe(true);
    expect(fenetreRecevable(FENETRE_PITR_JOURS_MAX + 1)).toBe(false);
    expect(fenetreRecevable(-1)).toBe(false);
    expect(fenetreRecevable(7.5)).toBe(false);
    expect(fenetreRecevable("7")).toBe(false);
    expect(fenetreRecevable(undefined)).toBe(false);
  });

  it("[LE CŒUR] une valeur illisible retombe sur le défaut — elle ne REFUSE PAS d'effacer", () => {
    // Le repli habituel de ce dépôt penche vers le moins d'effet ; ici l'inverse est le bon sens :
    // refuser d'effacer parce qu'une variable est mal écrite ferait d'une faute de frappe un refus
    // de droit. On efface, avec la fenêtre annoncée par défaut.
    expect(fenetreDepuisTexte(undefined)).toBe(FENETRE_PITR_JOURS_DEFAUT);
    expect(fenetreDepuisTexte("n'importe quoi")).toBe(FENETRE_PITR_JOURS_DEFAUT);
    expect(fenetreDepuisTexte("999")).toBe(FENETRE_PITR_JOURS_DEFAUT);
    expect(fenetreDepuisTexte("-3")).toBe(FENETRE_PITR_JOURS_DEFAUT);
    // …et une valeur valide est bien honorée (sinon le repli serait un plafond déguisé).
    expect(fenetreDepuisTexte(" 3 ")).toBe(3);
    expect(fenetreDepuisTexte("0")).toBe(0);
  });

  it("ce qu'on lui annonce suit le paramètre", () => {
    expect(copie.effacementFenetre(3)).toContain("3 jours");
    expect(copie.effacementFenetre(0)).toMatch(/aucune copie/i);
  });
});

describe("[6.7/AC1] L'appel du moteur ne se tait jamais", () => {
  const client = (reponse: unknown) => ({ rpc: async () => reponse }) as unknown as SupabaseClient;

  it("[LE CŒUR] une erreur LÈVE — un effacement muet serait annoncé comme réussi", async () => {
    await expect(effacerToutesSesDonnees(client({ data: null, error: { code: "42501" } }))).rejects.toThrow(
      /^effacement: 42501$/,
    );
  });

  it("[NFR-022] le message de Postgres ne remonte pas", async () => {
    await expect(
      effacerToutesSesDonnees(client({ data: null, error: { code: "23514", message: "valeur « cancer »" } })),
    ).rejects.not.toThrow(/cancer/);
  });

  it("[LE CŒUR] une réponse SANS trace lève — c'est la seule preuve que le moteur est allé au bout", async () => {
    await expect(effacerToutesSesDonnees(client({ data: null, error: null }))).rejects.toThrow(/sans_trace/);
    await expect(effacerToutesSesDonnees(client({ data: "", error: null }))).rejects.toThrow(/sans_trace/);
  });

  it("[CONTRÔLE POSITIF] une trace valide est rendue — sinon les gardes ci-dessus ne prouvent rien", async () => {
    expect(await effacerToutesSesDonnees(client({ data: "trace-123", error: null }))).toBe("trace-123");
  });

  it("[AD-14] la fenêtre part en ARGUMENT, lue dans l'environnement", async () => {
    vi.stubEnv("EFFACEMENT_FENETRE_PITR_JOURS", "3");
    const vus: Record<string, unknown>[] = [];
    const espion = {
      rpc: async (_nom: string, args: Record<string, unknown>) => {
        vus.push(args);
        return { data: "trace", error: null };
      },
    } as unknown as SupabaseClient;
    await effacerToutesSesDonnees(espion);
    expect(vus[0]).toEqual({ p_fenetre_pitr_jours: 3 });
    vi.unstubAllEnvs();
  });
});
