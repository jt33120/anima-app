import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import * as copie from "@/lib/domain/copie-mes-donnees";

/**
 * export-route.test.ts — LA ROUTE, LA HALTE, ET LES MOTS (Story 6.6, AC2/AC3).
 *
 * L'AC2 est une exigence NÉGATIVE : « fourni sans questionnaire ni délai artificiel, jamais
 * conditionné à une fermeture de compte ou à une suppression ». On ne prouve pas une absence en
 * regardant un écran — on la garde en refusant que le vocabulaire et les mécanismes de la dissuasion
 * puissent apparaître sur ce chemin.
 *
 * ⚠️ LA GARDE VISE LE CONDITIONNEMENT, PAS LA CO-PRÉSENCE. La Story 6.7 posera la suppression totale
 * sur cette même halte — son propre AC3 l'exige (« un export est proposé avant la suppression »).
 * Un garde qui interdirait le mot « supprimer » sur cette page ferait rougir 6.7 et serait
 * désactivé. Ce qu'on interdit est plus précis : que l'export lui-même exige quoi que ce soit.
 */

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const lire = (f: string) => sansCommentaires(readFileSync(resolve(racine, f), "utf-8"));

const ROUTE = lire("app/api/export/route.ts");
const PAGE = lire("app/mes-donnees/page.tsx");

describe("[6.6/AC1] Une seule route d'export, et c'est celle que `/barriere` connaît déjà", () => {
  it("[LE CŒUR] la route sert le document COMPLET, plus les quatre morceaux de la 1.9", () => {
    // ⚠️ ON MESURE L'APPEL, PAS LE NOM (revue Epic 6, R6). `toMatch(/chargerExport/)` était
    // satisfait par la seule ligne d'IMPORT : on pouvait remplacer l'appel par un document vide et
    // servir un fichier de trois lignes au titre de l'article 15, sans qu'un test bouge.
    expect(ROUTE, "`chargerExport` n'est plus APPELÉ — l'import ne prouve rien").toMatch(
      /await\s+chargerExport\s*\(/,
    );
    expect(ROUTE, "`rendreExportLisible` n'est plus APPELÉ").toMatch(/rendreExportLisible\s*\(/);
    // Les lectures table par table de la 1.9 ont disparu : elles ne couvraient que quatre couches.
    expect(ROUTE, "la route lit encore des tables à la main — l'export partiel est revenu").not.toMatch(
      /\.from\(/,
    );
  });

  it("[LE CŒUR] IL N'EN EXISTE PAS UNE SECONDE — deux exports, c'est un export faux quelque part", () => {
    const routes = (
      readdirSync(resolve(racine, "app/api"), { recursive: true, encoding: "utf-8" }) as string[]
    ).filter((f) => f.endsWith("route.ts"));
    const exportantes = routes.filter((f) => /attachment/i.test(lire(`app/api/${f}`)));
    expect(exportantes, `plusieurs routes servent un fichier : ${exportantes.join(", ")}`).toEqual([
      "export/route.ts",
    ]);
  });

  it("`/barriere` pointe toujours vers elle — une adolescente barrée a trente jours pour tout emporter", () => {
    expect(lire("app/barriere/page.tsx")).toMatch(/href="\/api\/export"/);
  });
});

describe("[6.6/AC2] L'export est AUTONOME — rien ne le conditionne", () => {
  it("[LE CŒUR] la route n'exige QUE d'être soi : pas de garde d'onboarding, pas de confirmation", () => {
    // Un compte suspendu sous barrière de minorité et quelqu'un qui a révoqué doivent pouvoir
    // exporter : c'est le sens même de « un export proposé avant suppression » (FR-071, AD-14) et
    // de l'article 15, qui survit à la révocation.
    expect(ROUTE).toMatch(/auth\.getUser\(\)/);
    expect(ROUTE, "une garde d'onboarding barre l'export").not.toMatch(/etapeOnboardingPour/);
    expect(ROUTE, "l'export demande une confirmation").not.toMatch(/confirm(er|ation)/i);
    expect(ROUTE, "l'export lit un paramètre — donc il pose une condition").not.toMatch(
      /searchParams|nextUrl\.searchParams/,
    );
  });

  it("[LE CŒUR] le lien est un `<a href>` NU — aucun état, donc aucune façon d'échouer en silence", () => {
    expect(PAGE).toMatch(/href="\/api\/export"/);
    expect(PAGE, "le téléchargement est passé par du JavaScript").not.toMatch(/onClick|useState|"use client"/);
    expect(PAGE, "le lien peut être désactivé").not.toMatch(/disabled/);
  });

  it("la halte ne redirige PAS quelqu'un qui a révoqué — l'accès survit à la révocation", () => {
    expect(PAGE).toMatch(/redirect\("\/consentement"\)/); // les autres gardes s'appliquent…
    expect(PAGE, "révoquer ferme l'accès à ses propres données").not.toMatch(
      /revoque[\s\S]{0,40}redirect/,
    );
  });
});

describe("[6.6/AC2] Les mots du chemin d'export ne dissuadent de rien", () => {
  /**
   * ⚠️ SEULEMENT LES CONSTANTES DU CHEMIN D'EXPORT, nommées une par une. Scanner le fichier entier
   * ferait rougir la 6.7 le jour où elle y posera la copie de la suppression — qui a le droit, elle,
   * de dire « définitivement ».
   */
  const CHEMIN = [
    copie.TITRE_HALTE,
    copie.INTRODUCTION,
    copie.ACTION_EXPORTER,
    copie.CE_QUE_TU_EMPORTES,
    copie.RIEN_NE_CHANGE,
    copie.DOCUMENT_TITRE,
    copie.DOCUMENT_PREAMBULE,
  ].join(" • ");

  const DISSUASION: readonly [string, RegExp][] = [
    ["une question posée avant de servir", /pourquoi|peux-tu nous dire|dis-nous/i],
    ["un « es-tu sûre » à étages", /es-tu s[ûu]re|confirme[rz]?|vraiment/i],
    ["un délai annoncé", /d[ée]lai|sous \d+\s*(h|jours?|heures?)|patiente|d'ici/i],
    ["un adossement à la fermeture du compte", /ferme[rz]? ton compte|fermeture de (ton )?compte|avant de partir/i],
    ["une retenue affective", /tu vas nous manquer|regrett|dommage/i],
  ];

  for (const [nom, motif] of DISSUASION) {
    it(`aucune trace de : ${nom}`, () => {
      expect(motif.test(CHEMIN), `« ${motif.source} » apparaît sur le chemin d'export`).toBe(false);
    });
  }

  it("[ANTI-VACUITÉ] les cinq motifs MORDENT sur la copie tentante qu'on aurait pu écrire", () => {
    // Sans ce contrôle, cinq expressions mal écrites passeraient sur n'importe quel texte, et les
    // cinq tests ci-dessus seraient verts en ne regardant rien.
    const tentant =
      "Avant de partir, peux-tu nous dire pourquoi ? Es-tu sûre ? Ton fichier arrivera sous 24 h. " +
      "Si tu fermes ton compte, tout sera perdu — tu vas nous manquer.";
    for (const [nom, motif] of DISSUASION) {
      expect(motif.test(tentant), `le motif « ${nom} » ne mord sur rien`).toBe(true);
    }
  });

  it("la halte DIT que télécharger ne change rien — l'autonomie s'annonce (AC2)", () => {
    expect(copie.RIEN_NE_CHANGE).toMatch(/reste/i);
  });
});

describe("[6.6/AC3] Rien ne part vers un tiers, et le fichier ne s'exécute pas chez nous", () => {
  it("aucun traceur, aucun outil d'analyse sur le chemin (NFR-002)", () => {
    for (const [nom, src] of [
      ["route", ROUTE],
      ["page", PAGE],
      ["rendu", lire("lib/domain/export-lisible.ts")],
      ["lecture", lire("lib/data/exporter-donnees.ts")],
    ] as const) {
      expect(src, `traceur dans ${nom}`).not.toMatch(
        /analytics|gtag|mixpanel|posthog|plausible|sentry|datadog/i,
      );
      expect(src, `appel sortant dans ${nom}`).not.toMatch(/https?:\/\/(?!127\.0\.0\.1)/);
    }
  });

  it("[LE CŒUR] le corps n'est JAMAIS servi en `text/html` — il est fait de son texte à elle", () => {
    // Servi en `text/html` depuis notre origine, il suffirait qu'un navigateur ignore le
    // `Content-Disposition` pour que tout ce qu'elle a écrit s'exécute dans l'origine de l'app.
    expect(ROUTE).toMatch(/"Content-Type":\s*"application\/octet-stream"/);
    expect(ROUTE).not.toMatch(/text\/html/);
    expect(ROUTE).toMatch(/"X-Content-Type-Options":\s*"nosniff"/);
    expect(ROUTE).toMatch(/Content-Disposition[\s\S]{0,40}attachment/);
  });

  it("la réponse n'est jamais mise en cache (art. 9)", () => {
    // ⚠️ ON MESURE L'ÉTALEMENT DANS LES EN-TÊTES (R6). `toMatch(/ENTETES_ART9/)` était satisfait
    // par la ligne d'import : retirer le `...ENTETES_ART9` de la réponse rendait un export art. 9
    // cachable par un intermédiaire, test toujours vert.
    expect(ROUTE, "`ENTETES_ART9` est importé mais plus étalé dans la réponse").toMatch(
      /\.\.\.ENTETES_ART9/,
    );
    expect(ROUTE).toMatch(/export const dynamic\s*=\s*"force-dynamic"/);
    expect(ROUTE).toMatch(/export const fetchCache\s*=\s*"force-no-store"/);
  });

  it("[LE CŒUR] une panne ne sert JAMAIS un fichier — elle renvoie sur la halte", () => {
    // Un fichier de trois lignes se lirait « il ne reste rien de moi ». C'est la leçon de 4.6, 4.9
    // puis 6.5, et elle est ici à son maximum de gravité.
    expect(ROUTE).toMatch(/catch[\s\S]{0,220}redirect\(new URL\("\/mes-donnees\?echec=1"/);
    expect(ROUTE).toMatch(/journaliserIncidentSecurite/);
  });
});
