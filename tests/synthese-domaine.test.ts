import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { readdirSync, statSync } from "node:fs";
import {
  aQuelqueChoseADire,
  periodeDe,
  PLAFOND_ENTREES,
  PLAFOND_NOTIFICATION_HEURES,
  LOT_PAR_TICK,
  type MateriauSynthese,
} from "@/lib/domain/synthese";
import { consigneSynthese, messagesSynthese } from "@/lib/domain/consigne-synthese";
import { GABARITS, EXPEDITEUR_NOM } from "@/lib/courriel/gabarits";

/**
 * Story 4.9 (T7) — LE DOMAINE PUR et LA SURFACE SORTANTE.
 *
 * Deux choses très différentes cohabitent ici, et pour une seule raison : ce sont les deux seules du
 * périmètre qui soient prouvables SANS base et SANS modèle. Le domaine, parce qu'il est pur. Les
 * gabarits, parce que — contrairement au texte du modèle — ils EXISTENT en source, donc un test statique
 * a prise sur eux.
 */

const RACINE = process.cwd();

function materiau(p: Partial<MateriauSynthese> = {}): MateriauSynthese {
  return {
    depuis: null,
    jusqu_a: "2026-08-05T04:00:00.000Z",
    total: 0,
    tronquee: false,
    entrees: [],
    faits: [],
    ...p,
  };
}

const E = (contenu: string, cree_le: string): MateriauSynthese["entrees"][number] => ({
  role: "utilisatrice",
  contenu,
  cree_le,
});

describe("[D3 / FR-034] y a-t-il quelque chose à dire ?", () => {
  it("une entrée suffit ; aucune entrée ne suffit pas", () => {
    expect(aQuelqueChoseADire(materiau({ entrees: [E("un mot", "2026-08-01T00:00:00Z")] }))).toBe(true);
    expect(aQuelqueChoseADire(materiau())).toBe(false);
  });

  it("[LE PIÈGE] des FAITS sans entrée ne suffisent pas", () => {
    // Mutation-cible : `entrees.length > 0 || faits.length > 0`. Les faits sont CUMULATIFS et survivent
    // aux périodes : « il existe des faits » devient vrai pour toujours dès la première semaine. On
    // produirait alors une synthèse chaque semaine, y compris les vides — soit exactement le « message
    // générique récurrent » que FR-034 interdit, et un appel au modèle fort pour dire qu'il n'y a rien.
    expect(aQuelqueChoseADire(materiau({ faits: ["elle dessine", "elle a un frère"] }))).toBe(false);
  });
});

describe("[D2] la période racontée", () => {
  it("part de la plus ancienne entrée GARDÉE, pas de `depuis`", () => {
    // Mutation-cible : `debut: materiau.depuis ?? …`. Quand le plafond a mordu, les entrées les plus
    // anciennes ont été écartées : annoncer `depuis` promettrait un récit qu'on n'a pas écrit, et le
    // silence sur ce début se lirait comme « il ne s'est rien passé ».
    const m = materiau({
      depuis: "2026-01-01T00:00:00Z",
      tronquee: true,
      total: 999,
      entrees: [E("a", "2026-07-30T10:00:00Z"), E("b", "2026-08-02T10:00:00Z")],
    });
    expect(periodeDe(m)).toEqual({
      debut: "2026-07-30T10:00:00Z",
      fin: "2026-08-05T04:00:00.000Z",
      tronquee: true,
    });
  });

  it("rend `null` quand il n'y a rien — elle ne fabrique pas une période à partir de rien", () => {
    expect(periodeDe(materiau())).toBeNull();
  });
});

describe("les plafonds sont des valeurs, pas des intentions", () => {
  it("chacun est borné et cohérent avec ce qu'il protège", () => {
    // `PLAFOND_ENTREES` doit rester très au-delà d'une semaine ordinaire (sinon la troncature devient la
    // règle) et sous la fenêtre du modèle fort. `LOT_PAR_TICK` doit tenir dans une lambda de 60 s.
    expect(PLAFOND_ENTREES).toBeGreaterThanOrEqual(100);
    expect(PLAFOND_NOTIFICATION_HEURES).toBe(72); // FR-035, plafond du PRD
    expect(LOT_PAR_TICK).toBeLessThanOrEqual(30);
  });
});

describe("la consigne et le matériau mis en messages", () => {
  it("la consigne est un message SYSTÈME — injectée serveur, jamais reçue du client", () => {
    expect(consigneSynthese().role).toBe("system");
  });

  it("[LE PIÈGE] le journal part en UN message, pas en tours de conversation", () => {
    // Mutation-cible : un message par entrée, avec les rôles `user`/`assistant`. Le modèle répondrait
    // alors au DERNIER message au lieu de survoler la période — c'est le piège classique de la synthèse
    // par chat, et il ne produit pas une erreur : il produit une synthèse qui parle d'autre chose.
    const messages = messagesSynthese(
      materiau({ entrees: [E("j'ai repris le dessin", "2026-08-01T10:00:00Z"), E("et j'ai arrêté", "2026-08-02T10:00:00Z")] }),
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toContain("j'ai repris le dessin");
    expect(messages[0].content).toContain("et j'ai arrêté");
  });

  it("la troncature est AVOUÉE dans le matériau lui-même", () => {
    // Le modèle doit pouvoir écrire « cette synthèse commence le … » sans qu'on le lui rappelle après.
    const m = materiau({ tronquee: true, total: 900, entrees: [E("a", "2026-08-01T10:00:00Z")] });
    expect(messagesSynthese(m)[0].content).toMatch(/900/);
    expect(messagesSynthese(materiau({ entrees: [E("a", "2026-08-01T10:00:00Z")] }))[0].content).not.toMatch(
      /ne couvre pas/,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC4 / FR-035 / NFR-015] ce qui SORT vers le serveur de messagerie", () => {
  const source = readFileSync(resolve(RACINE, "lib/courriel/gabarits.ts"), "utf-8");

  it("[LE CŒUR] aucun gabarit n'est INTERPOLÉ — pas un seul `${}` dans le fichier", () => {
    // C'est LA garde du fichier, et elle est textuelle à dessein. Un gabarit qui accepterait une valeur
    // serait un gabarit par lequel de l'art. 9 pourrait sortir — le scénario banal étant « ajoutons le
    // premier paragraphe de la synthèse en aperçu, c'est plus engageant ». Ce paragraphe s'afficherait
    // sur un écran verrouillé, potentiellement devant quelqu'un d'autre, et traînerait pour toujours
    // dans les journaux d'un serveur de messagerie.
    const corpsSeul = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(corpsSeul, "aucune interpolation").not.toMatch(/\$\{/);
    expect(corpsSeul, "aucune concaténation de variable non plus").not.toMatch(/\+\s*[a-z]\w*\s*\+/);
  });

  it("l'ensemble des motifs est FERMÉ, et c'est le même que celui de la base", () => {
    // La migration 0029 contraint `motif in ('synthese_prete')`. Les deux listes doivent rester égales :
    // un motif ajouté d'un seul côté produirait un envoi que la base refuse de tracer, ou l'inverse.
    expect(Object.keys(GABARITS)).toEqual(["synthese_prete"]);
    const migration = readFileSync(resolve(RACINE, "supabase/migrations/0029_synthese_periodique.sql"), "utf-8");
    for (const motif of Object.keys(GABARITS)) expect(migration).toContain(`'${motif}'`);
  });

  it("l'OBJET est celui du dossier UX, et il ne dit ni l'intimité ni l'ésotérisme", () => {
    // NFR-015 : « nom, icône et aperçus de notification ne révèlent ni l'intimité du contenu ni un
    // registre ésotérique ». L'objet est ce qui s'affiche sur l'écran verrouillé.
    expect(GABARITS.synthese_prete.objet).toBe("Ta synthèse est prête");
    expect(EXPEDITEUR_NOM).toBe("Anam");
  });

  it("aucun mot du registre intime ou ésotérique dans le corps", () => {
    const tout = Object.values(GABARITS)
      .map((g) => `${g.objet}\n${g.texte}`)
      .join("\n")
      .toLowerCase();
    for (const interdit of [
      "astral", "thème", "horoscope", "ennéagramme", "tarot", "tirage", "lune", "spirituel",
      "branche", "arbre", "détresse", "émotion", "thérapie", "guérison", "soin",
    ]) {
      expect(tout, `« ${interdit} » n'a rien à faire sur un écran verrouillé`).not.toContain(interdit);
    }
  });

  it("le lien mène à la HALTE, jamais au contenu", () => {
    // Une URL se transfère, se journalise et se prévisualise. Un lien qui afficherait la synthèse sans
    // authentification serait une fuite d'art. 9 par URL — d'où une adresse de page, qui exige la session.
    expect(GABARITS.synthese_prete.texte).toContain("/synthese");
    expect(GABARITS.synthese_prete.texte, "aucun jeton dans l'URL").not.toMatch(/token|jeton|[?&]t=/i);
  });
});

describe("[AD-3] un seul fournisseur d'envoi, un seul lecteur de sa clé", () => {
  function fichiersSous(dossier: string): string[] {
    const base = resolve(RACINE, dossier);
    const trouves: string[] = [];
    const parcourir = (d: string) => {
      for (const entree of readdirSync(d)) {
        const chemin = join(d, entree);
        if (statSync(chemin).isDirectory()) parcourir(chemin);
        else if (/\.tsx?$/.test(chemin)) trouves.push(chemin);
      }
    };
    parcourir(base);
    return trouves;
  }
  const SOURCES = [...fichiersSous("lib"), ...fichiersSous("app"), ...fichiersSous("render")];
  const sans = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("un SEUL fichier parle à Resend", () => {
    // Même règle que pour `AiPort` (AD-3) : aucun code hors de l'adaptateur ne connaît le fournisseur.
    // Un second appelant serait un second endroit où décider quoi mettre dans un courriel.
    const parleurs = SOURCES.filter((f) => /api\.resend\.com/.test(sans(readFileSync(f, "utf-8")))).map((f) =>
      f.slice(RACINE.length + 1),
    );
    expect(parleurs).toEqual([join("lib", "courriel", "adaptateurs", "resend.ts")]);
  });

  it("`RESEND_API_KEY` n'est lue que par la fabrique", () => {
    const lecteurs = SOURCES.filter((f) => /RESEND_API_KEY/.test(sans(readFileSync(f, "utf-8")))).map((f) =>
      f.slice(RACINE.length + 1),
    );
    expect(lecteurs).toEqual([join("lib", "courriel", "fabrique.ts")]);
  });

  it("le port courriel n'est utilisé que par le job de synthèse", () => {
    // Mutation-cible : envoyer un courriel depuis une route (« juste une confirmation »). Chaque
    // appelant supplémentaire échappe au plafond de 72 h — qui n'est plafond que s'il est le seul chemin.
    const appelants = SOURCES.filter((f) => !f.includes(join("lib", "courriel")))
      .filter((f) => /@\/lib\/courriel\//.test(sans(readFileSync(f, "utf-8"))))
      .map((f) => f.slice(RACINE.length + 1));
    expect(appelants).toEqual([join("lib", "ordonnanceur", "jobs", "synthese.ts")]);
  });

  it("`.env.example` documente les deux variables — un secret non documenté est un secret qu'on oublie", () => {
    const exemple = readFileSync(resolve(RACINE, ".env.example"), "utf-8");
    expect(exemple).toMatch(/^RESEND_API_KEY=/m);
    expect(exemple).toMatch(/^ANIMA_COURRIEL_EXPEDITEUR=/m);
  });
});
