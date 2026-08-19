import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { CORPS_POUSSEE, TITRE_POUSSEE } from "@/lib/domain/socle-quotidien";
import { MOTIFS_POUSSEE } from "@/lib/poussee/port";
import { PALIER, TICKS_MAX_PAR_JOUR } from "@/lib/domain/ordonnanceur-budget";

/**
 * Story 6.2 — LES GARDES DE SOURCE DE LA POUSSÉE.
 *
 * Quatre coutures que rien d'autre ne tient, parce qu'elles relient des fichiers qui ne s'importent
 * pas les uns les autres : un JavaScript nu servi depuis `public/`, un JSON, un manifeste de
 * plateforme, et du TypeScript. Aucun compilateur ne les regarde ensemble ; sans ces tests, chacune
 * dérive en silence.
 */

const racine = resolve(__dirname, "..");
const lire = (chemin: string) => readFileSync(resolve(racine, chemin), "utf8");

/**
 * Le fichier PRIVÉ DE SES COMMENTAIRES.
 *
 * ⚠️ Née d'un rouge immédiat, et la leçon vaut d'être gardée : la première version de la garde
 * ci-dessous cherchait `addEventListener("fetch"` dans `public/sw.js` — et le trouvait **dans
 * l'en-tête qui explique pourquoi il ne doit pas s'y trouver**. Une garde qui accuse sa propre
 * documentation pousse à affaiblir la garde plutôt qu'à la corriger, et c'est exactement comme ça
 * qu'on se retrouve avec une expression régulière si étroite qu'elle ne trouve plus rien.
 *
 * On scanne donc le CODE. Les commentaires ont le droit de nommer ce qu'ils interdisent.
 */
const sansCommentaires = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

describe("[6.2/AC7] le service worker ne fait QUE la poussée", () => {
  const sw = sansCommentaires(lire("public/sw.js"));

  it("[LE CŒUR] aucun gestionnaire `fetch`, aucune API `caches`", () => {
    // ⚠️ Un service worker qui met en cache est la façon la plus fiable de livrer une application que
    // l'utilisatrice ne peut plus mettre à jour. Sur un produit qui porte de l'art. 9, servir un
    // écran de CONSENTEMENT périmé est une faute grave : le texte qu'elle a accepté ne serait plus
    // celui qui s'applique, et elle n'aurait aucun moyen de s'en apercevoir ni de le vider.
    expect(sw, "un gestionnaire `fetch` est apparu dans le service worker").not.toMatch(
      /addEventListener\s*\(\s*["']fetch["']/,
    );
    expect(sw, "l’API `caches` est apparue dans le service worker").not.toMatch(/\bcaches\s*\./);
    expect(sw).not.toMatch(/\bimportScripts\s*\(/);
  });

  it("il écoute bien la poussée — sans quoi la garde ci-dessus est satisfaite par un fichier vide", () => {
    expect(sw).toMatch(/addEventListener\s*\(\s*["']push["']/);
    expect(sw).toMatch(/showNotification/);
    expect(sw).toMatch(/addEventListener\s*\(\s*["']notificationclick["']/);
  });

  it("[LE CŒUR] l’ensemble fini du service worker est le MIROIR EXACT du domaine", () => {
    // ⚠️ C'est la couture la plus fragile de la story : le texte relu vit dans `lib/domain/`, où trois
    // détecteurs le passent au crible (prédiction, lexique interdit, lexique d'aperçu) ; le texte
    // AFFICHÉ vit ici, dans un fichier que rien ne compile. Sans ce test, corriger une virgule d'un
    // côté ferait diverger les deux — et c'est l'ensemble NON RELU qui s'afficherait sur un écran
    // verrouillé.
    const bloc = sw.match(/const CORPS_POUSSEE = \[([\s\S]*?)\];/);
    expect(bloc, "l’ensemble n’est plus déclaré sous la forme attendue").not.toBeNull();
    const lignes = [...bloc![1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`));
    expect(lignes).toEqual([...CORPS_POUSSEE]);
    expect(sw).toContain(`const TITRE_POUSSEE = ${JSON.stringify(TITRE_POUSSEE)};`);
  });

  it("[LE CŒUR] l’index du jour est le même calcul des deux côtés", () => {
    // Deux listes identiques parcourues par deux formules différentes afficheraient quand même deux
    // textes différents. On compare donc aussi la FORMULE — le compte absolu de jours, et jamais un
    // jour de l'année (qui retombe à 0 le 1er janvier).
    expect(sw).toMatch(/Date\.UTC\(a, m - 1, j\) \/ 86400000/);
    expect(sw).toMatch(/\(\(jours % taille\) \+ taille\) % taille/);
    expect(sw, "le jour se calcule à Paris, le fuseau unique du produit (D3)").toContain("Europe/Paris");
  });

  it("aucun texte du service worker ne trahit le produit", () => {
    // Le fichier est PUBLIC : n'importe qui peut le lire à `/sw.js`. Ce n'est pas une fuite en soi
    // (les corps sont conçus pour être vus), mais c'est la porte par laquelle un jour quelqu'un
    // ajoutera « juste » un mot du domaine dans un commentaire ou un `tag`.
    expect(sw.toLowerCase()).not.toMatch(/horoscope|tarot|voyance|astrolog|ennéagramme|enneagramme/);
  });
});

describe("[6.2/D1] la poussée sans charge utile a une DATE DE PÉREMPTION, et elle est gardée", () => {
  it("[LE CŒUR] un SECOND motif de poussée exige que le transport apprenne à le porter", () => {
    // ⚠️ CE TEST EST UN AVERTISSEMENT DATÉ, pas une garde d'invariant.
    //
    // Tant que `MOTIFS_POUSSEE` n'a qu'un membre, le service worker sait quoi afficher sans qu'on le
    // lui dise : il n'y a qu'un texte possible. Au DEUXIÈME motif — Story 6.3, « Anam rare et
    // spécifique » — il ne le saura plus, et la notification d'Anam afficherait silencieusement le
    // texte du socle. Personne ne s'en apercevrait : les deux sont plausibles sur un écran verrouillé.
    //
    // Le jour où ce test rougit, le remède n'est PAS de le supprimer. C'est l'un des deux :
    //   • chiffrer une charge utile minimale (RFC 8291 : ECDH P-256, HKDF, AES-128-GCM) portant le
    //     MOTIF et rien d'autre — `p256dh` et `auth` sont déjà stockés pour ça ;
    //   • ou faire lire au service worker, à la réception, un motif servi par une route de session.
    //
    // Dans les deux cas la propriété structurelle tient : aucun paramètre de texte libre nulle part.
    expect(
      MOTIFS_POUSSEE.length,
      "un second motif de poussée est apparu — voir le commentaire de ce test avant de le modifier",
    ).toBe(1);
    expect(MOTIFS_POUSSEE[0]).toBe("socle_quotidien");
  });

  it("l’adaptateur ne poste aucun corps, et ne connaît aucun chiffrement", () => {
    const adaptateur = sansCommentaires(lire("lib/poussee/adaptateurs/web-push.ts"));
    expect(adaptateur).not.toMatch(/body\s*:/);
    expect(adaptateur).not.toMatch(/Content-Encoding|aes128gcm|deriveBits/);
  });
});

describe("[6.2/AC8] la cadence déclarée est celle que le palier autorise", () => {
  it("[LE CŒUR] `vercel.json` ne déclare pas plus de ticks que le palier n’en accepte", () => {
    // ⚠️ Sur `hobby`, une expression cron plus fréquente qu'une fois par jour FAIT ÉCHOUER LE
    // DÉPLOIEMENT — pas de dégradation silencieuse, un refus. Cette garde amène ce refus en CI,
    // c'est-à-dire avant que la branche ne parte, et surtout avant qu'un déploiement raté ne laisse
    // la production sur la version d'avant sans que personne ne comprenne pourquoi.
    //
    // Et elle mord dans l'autre sens le jour du passage à `pro` : le socle ne servira son heure que
    // si l'expression devient horaire. Un palier acheté sans changer le cron ne changerait rien.
    const vercel = JSON.parse(lire("vercel.json")) as { crons: { path: string; schedule: string }[] };
    const cron = vercel.crons.find((c) => c.path === "/api/ordonnanceur");
    expect(cron, "l’ordonnanceur n’est plus déclaré dans vercel.json").toBeDefined();

    const [minute, heure] = cron!.schedule.split(" ");
    const ticksParJour =
      (heure === "*" ? 24 : heure.split(",").length) * (minute === "*" ? 60 : minute.split(",").length);
    expect(
      ticksParJour,
      `l’expression « ${cron!.schedule} » demande ${ticksParJour} ticks/jour, le palier ${PALIER} en accepte ${TICKS_MAX_PAR_JOUR[PALIER]}`,
    ).toBeLessThanOrEqual(TICKS_MAX_PAR_JOUR[PALIER]);
  });

  it("[MÉTA] le compteur de ticks compte VRAIMENT", () => {
    // Sans ça, un compteur qui rendrait toujours 1 rendrait la garde ci-dessus verte pour toute
    // expression, y compris « toutes les minutes ».
    const compter = (s: string) => {
      const [minute, heure] = s.split(" ");
      return (heure === "*" ? 24 : heure.split(",").length) * (minute === "*" ? 60 : minute.split(",").length);
    };
    expect(compter("0 6 * * *")).toBe(1);
    expect(compter("0 * * * *")).toBe(24);
    expect(compter("* * * * *")).toBe(1440);
    expect(compter("0 6,18 * * *")).toBe(2);
  });
});

describe("[6.2/AC4] le manifeste est neutre, et l’icône ne trahit rien", () => {
  const manifeste = JSON.parse(lire("public/manifest.webmanifest")) as Record<string, unknown>;

  it("le nom exposé est le même mot que partout ailleurs", () => {
    // Trois surfaces vues par le monde — l'onglet, la grille d'icônes, l'aperçu de notification —
    // et un seul mot. NFR-015 : on tend le téléphone deux secondes, rien ne sort.
    expect(manifeste.name).toBe(TITRE_POUSSEE);
    expect(manifeste.short_name).toBe(TITRE_POUSSEE);
    expect(JSON.stringify(manifeste).toLowerCase()).not.toMatch(
      /horoscope|tarot|voyance|astrolog|spirituel|médium|medium/,
    );
  });

  it("[LE CŒUR] les icônes déclarées EXISTENT vraiment sur le disque", () => {
    // ⚠️ Une icône manquante n'est pas cosmétique ici. Sur iOS, une PWA sans icône installable prend
    // pour vignette une CAPTURE DE LA PAGE — c'est-à-dire l'imagerie de séance, sur l'écran d'accueil,
    // ce que le privacy-cover (AC5) existe précisément pour empêcher. Le défaut serait donc une
    // violation de NFR-015 par omission, et invisible tant que personne n'installe l'app.
    const fichiers = new Set(readdirSync(resolve(racine, "public/marque")));
    const icones = manifeste.icons as { src: string; sizes: string }[];
    expect(icones.length).toBeGreaterThan(0);
    for (const icone of icones) {
      expect(icone.src.startsWith("/marque/"), `icône hors de /marque : ${icone.src}`).toBe(true);
      expect(fichiers.has(icone.src.replace("/marque/", "")), `icône absente : ${icone.src}`).toBe(true);
    }
    expect(icones.some((i) => i.sizes === "192x192")).toBe(true);
    expect(icones.some((i) => i.sizes === "512x512")).toBe(true);
    // iOS ignore le manifeste pour l'icône d'accueil et lit `apple-touch-icon` : elle doit exister.
    expect(fichiers.has("icone-apple-180.png"), "l’icône Apple 180 manque — iOS prendrait une capture").toBe(
      true,
    );
  });

  it("le manifeste et le service worker sont bien référencés par le document", () => {
    const layout = lire("app/layout.tsx");
    expect(layout).toContain("manifest.webmanifest");
    expect(layout).toContain("icone-apple-180.png");
  });
});
