// ⚠️ AVANT TOUT IMPORT. Le fuseau de la MACHINE est déplacé à l'autre bout du monde, exprès : sans
// ça, sur une machine réglée à Paris, un rendu qui aurait OUBLIÉ `timeZone: "Europe/Paris"` donnerait
// exactement le bon résultat et le mutant survivrait — vert chez le développeur, faux en production
// (Vercel vit en UTC). Vitest isole chaque fichier de test, donc ce réglage ne fuit pas ailleurs.
process.env.TZ = "Pacific/Kiritimati";

import { describe, it, expect } from "vitest";
import {
  echapper,
  nomFichierExport,
  ordonnerSections,
  rendreExportLisible,
  type DocumentExport,
} from "@/lib/domain/export-lisible";
import { TABLES_EXPORTEES } from "@/lib/domain/inventaire-export";

/**
 * export-lisible.test.ts — LE DOCUMENT QU'ELLE OUVRE (Story 6.6, AC1).
 *
 * Trois propriétés, et aucune n'est cosmétique :
 *   • rien ne DISPARAÎT du document, même une section que ce fichier ne connaît pas ;
 *   • rien ne S'EXÉCUTE, alors que tout le contenu a été écrit par elle ;
 *   • une heure affichée est la SIENNE, pas celle du serveur qui a fabriqué le fichier.
 */

function doc(partiel: Record<string, unknown> = {}): DocumentExport {
  return {
    version: 1,
    genere_le: "2026-08-16T23:30:00+00:00",
    retraits: [{ table: "abonnement_poussee", colonnes: ["cle_auth"], motif: "une capacité, pas une donnée" }],
    ...partiel,
  } as DocumentExport;
}

describe("[6.6/AC1] Rien ne disparaît — l'itération se fait sur le DOCUMENT, pas sur l'inventaire", () => {
  it("[LE CŒUR] une section INCONNUE de l'inventaire est rendue quand même", () => {
    // C'est la garde qui protège la 6.7 et la 6.8 d'elles-mêmes : une table ajoutée demain à la RPC
    // apparaît dans le fichier sans que personne n'ait à toucher ce module. Le contraire — itérer
    // sur l'inventaire — la ferait disparaître en silence du seul endroit où personne ne vérifie.
    const html = rendreExportLisible(doc({ table_de_demain: [{ contenu: "une ligne née après 6.6" }] }));
    expect(html).toContain("table_de_demain");
    expect(html).toContain("une ligne née après 6.6");
  });

  it("l'ordre suit l'inventaire, puis les inconnues à la fin", () => {
    const ordre = ordonnerSections(doc({ table_de_demain: [], entree_journal: [], utilisatrice: [] }));
    expect(ordre).toEqual(["utilisatrice", "entree_journal", "table_de_demain"]);
  });

  it("les clés d'en-tête ne deviennent JAMAIS des sections", () => {
    const ordre = ordonnerSections(doc());
    expect(ordre).toEqual([]);
  });

  it("une section VIDE est annoncée, jamais omise — l'absence de titre se lirait comme une perte", () => {
    const html = rendreExportLisible(doc({ branche: [] }));
    expect(html).toContain("Tes branches");
    expect(html).toContain("Rien dans cette partie.");
  });

  it("[ANTI-VACUITÉ] les 29 sections de l'inventaire sortent toutes du rendu", () => {
    const complet = Object.fromEntries(TABLES_EXPORTEES.map((t) => [t, [{ marqueur: `ici-${t}` }]]));
    const html = rendreExportLisible(doc(complet));
    for (const t of TABLES_EXPORTEES) {
      expect(html, `section absente du document : ${t}`).toContain(`ici-${t}`);
      expect(html, `ancre absente : ${t}`).toContain(`id="s-${t}"`);
    }
  });
});

describe("[6.6] Rien ne s'exécute — tout le contenu a été écrit par elle", () => {
  it("[LE CŒUR] un `<script>` tapé dans une conversation est MONTRÉ, pas exécuté", () => {
    const html = rendreExportLisible(
      doc({
        entree_journal: [
          { role: "utilisatrice", contenu: "<script>alert(1)</script>", cree_le: "2026-08-10T09:00:00+00:00" },
        ],
      }),
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("[LE CŒUR] un `</script>` ne referme pas l'annexe JSON", () => {
    // Sans la neutralisation du `<`, cette chaîne refermerait la balise et livrerait tout le reste
    // du fichier au parseur HTML — depuis un fichier qu'elle ouvre en double-cliquant.
    const html = rendreExportLisible(doc({ synthese: [{ contenu: "</script><img src=x onerror=alert(1)>" }] }));
    const annexe = html.slice(html.indexOf('id="donnees-brutes"'));
    expect(annexe).not.toContain("</script><img");
    expect(annexe).toContain("\\u003c/script");
    // Une seule balise fermante dans l'annexe : celle du `<script>` lui-même.
    expect(annexe.match(/<\/script>/g)).toHaveLength(1);
  });

  it("les guillemets et esperluettes d'un nom de branche ne cassent pas le markup", () => {
    expect(echapper(`Rose & "Marie" <3 l'été`)).toBe("Rose &amp; &quot;Marie&quot; &lt;3 l&#39;été");
  });

  it("le fichier interdit toute requête sortante quand elle l'ouvrira", () => {
    // Il vivra sur son disque, peut-être des années. Rien de ce qu'il contient ne doit pouvoir
    // partir quelque part si un jour quelqu'un y glisse une balise.
    expect(rendreExportLisible(doc())).toContain("default-src 'none'");
  });
});

describe("[6.6] Les heures sont les SIENNES, pas celles du serveur", () => {
  it("[LE CŒUR] 23 h 30 UTC devient le 17 août à 01 h 30 — Paris, jamais la machine", () => {
    const html = rendreExportLisible(doc());
    expect(html).toContain("17 août 2026 à 01:30");
    // La machine de ce test vit à UTC+14 : sans fuseau explicite, on lirait 13:30.
    expect(html).not.toContain("13:30");
  });

  it("le nom du fichier porte le jour de PARIS", () => {
    // ⚠️ 21 h UTC, ET C'EST LA CAMPAGNE DE MUTATION QUI A IMPOSÉ CETTE HEURE-LÀ. Avec le 23 h 30 de
    // l'en-tête, Paris (le 17 à 01 h 30) et la machine du test (UTC+14, le 17 à 13 h 30) tombent le
    // MÊME JOUR : le nom de fichier était identique avec ou sans fuseau, et le mutant survivait.
    // À 21 h UTC les deux jours divergent — c'est la seule forme d'assertion qui prouve quelque chose.
    expect(nomFichierExport(doc({ genere_le: "2026-08-16T21:00:00+00:00" }))).toBe(
      "anam-mes-donnees-2026-08-16.html",
    );
  });

  it("une date CIVILE est découpée, jamais convertie — sinon elle bascule d'un jour", () => {
    // `date_naissance` est un `date` : le 3 mars reste le 3 mars, même vu d'UTC+14.
    const html = rendreExportLisible(doc({ utilisatrice: [{ date_naissance: "1991-03-03" }] }));
    expect(html).toContain("3 mars 1991");
  });

  it("un horodatage illisible est rendu tel quel plutôt que perdu", () => {
    const html = rendreExportLisible(doc({ branche: [{ cree_le: "pas-une-date" }] }));
    expect(html).toContain("pas-une-date");
    expect(nomFichierExport(doc({ genere_le: "n'importe quoi" }))).toBe("anam-mes-donnees-sans-date.html");
  });
});

describe("[6.6/AC1] Les conversations se lisent comme des conversations", () => {
  const html = rendreExportLisible(
    doc({
      entree_journal: [
        { role: "utilisatrice", contenu: "j'ai quitté Paris", cree_le: "2026-08-10T09:00:00+00:00" },
        { role: "anam", contenu: "Qu'est-ce qui a changé depuis ?", cree_le: "2026-08-10T09:01:00+00:00" },
        { role: "utilisatrice", contenu: "tout", cree_le: "2026-08-12T20:00:00+00:00" },
      ],
    }),
  );

  it("chaque tour porte QUI parle, en clair", () => {
    expect(html).toContain(">Toi<");
    expect(html).toContain(">Anam<");
  });

  it("les jours sont des repères, et un seul par groupe", () => {
    expect(html.match(/class="jour"/g)).toHaveLength(2); // 10 et 12 août, pas trois
  });

  it("les autres sections restent en fiches — une par ligne, une définition par colonne", () => {
    const generique = rendreExportLisible(doc({ branche: [{ nom: "le déménagement", etat: "feuillaison" }] }));
    expect(generique).toContain("<dt>Nom</dt><dd>le déménagement</dd>");
    expect(generique).toContain("<dt>Etat</dt><dd>feuillaison</dd>");
  });

  it("un booléen se lit, un vide se voit", () => {
    const generique = rendreExportLisible(doc({ synthese: [{ tronquee: false, contenu: null }] }));
    expect(generique).toContain("<dd>non</dd>");
    expect(generique).toContain("<dd>—</dd>");
  });
});

describe("[6.6/AC1] Les deux droits tiennent dans le même fichier", () => {
  it("l'annexe JSON porte le document COMPLET, reprenable par une machine (art. 20)", () => {
    const html = rendreExportLisible(doc({ branche: [{ nom: "le déménagement" }] }));
    const brut = html.slice(
      html.indexOf('id="donnees-brutes">') + 'id="donnees-brutes">'.length,
      html.lastIndexOf("</script>"),
    );
    const repris = JSON.parse(brut.replace(/\\u003c/g, "<"));
    expect(repris.branche[0].nom).toBe("le déménagement");
    expect(repris.genere_le).toBe("2026-08-16T23:30:00+00:00");
  });

  it("les retraits sont ANNONCÉS dans le document", () => {
    const html = rendreExportLisible(doc());
    expect(html).toContain("cle_auth");
    expect(html).toContain("une capacité, pas une donnée");
  });
});
