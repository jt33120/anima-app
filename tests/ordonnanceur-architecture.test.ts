import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, rmSync, statSync, existsSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { REGISTRE } from "@/lib/ordonnanceur/registre";
import { RESERVE_PERSONNE_MS } from "@/lib/domain/synthese";
import { RESERVE_INCIDENT_MS } from "@/lib/ordonnanceur/jobs/sante";
import { NOM_JOB as NOM_RAPPEL, RESERVE_ENVOI_MS } from "@/lib/ordonnanceur/jobs/rappel-echeance";
import {
  NOM_JOB as NOM_SOCLE,
  RESERVE_PERSONNE_POUSSEE_MS,
} from "@/lib/ordonnanceur/jobs/socle-quotidien";
import {
  BUDGET_TICK_MS,
  COUT_ALLER_RETOUR_MS,
  COUT_PAR_JOB_MS,
  DERIVE_PLANIFICATION_MS,
  PALIER,
  PLAFOND_DUREE_MS,
  RESERVE_DECLAREE_MS,
  TICKS_MAX_PAR_JOUR,
  margeHorsDelais,
} from "@/lib/domain/ordonnanceur-budget";

/**
 * Story 4.8 (T8) — LES GARDES D'ARCHITECTURE. C'est ici que « aucun mécanisme périodique hors de
 * l'ordonnanceur » (AC1) cesse d'être une intention et devient une propriété du dépôt, vérifiée à chaque
 * push (AC4).
 *
 * Le raisonnement — le même qu'en 4.7, et il vaut d'être répété : on ne prouve pas une NON-EXISTENCE par
 * des exemples. Ce qu'on peut faire, c'est fermer les portes une à une et vérifier qu'il n'en reste qu'une.
 * D'où des gardes de SOURCE : elles prouvent le câblage, pas le comportement. Leur pendant comportemental
 * vit dans `ordonnanceur-endpoint` et `ordonnanceur-sql`.
 */

const RACINE = process.cwd();

function fichiersSous(dossier: string, extensions = [".ts", ".tsx"]): string[] {
  const base = resolve(RACINE, dossier);
  const trouves: string[] = [];
  const parcourir = (d: string) => {
    for (const entree of readdirSync(d)) {
      const chemin = join(d, entree);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (extensions.some((e) => chemin.endsWith(e))) trouves.push(chemin);
    }
  };
  parcourir(base);
  return trouves;
}

/**
 * Retire les commentaires : une MENTION en commentaire n'est pas un mécanisme (piège payé en 4.6 et 4.7).
 *
 * ⚠️ Les commentaires de FIN DE LIGNE comptent aussi (corrigé en revue de la 6.1). La version
 * initiale n'effaçait que les `//` en début de ligne : un `clore(x); // on clore ici avec e.message`
 * suffisait à faire rougir la garde du vocabulaire fermé sur une simple phrase d'explication. Une
 * garde qui rougit sur du code sain finit par être désactivée — c'est comme ça qu'on perd une garde.
 *
 * Le `[^:]` évite d'amputer `https://…` dans une chaîne, qui est le faux positif évident de cette
 * correction. Le contrôle `[MÉTA]` juste en dessous exerce les deux sens.
 */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/([^:])\/\/.*$/gm, "$1");
}

/**
 * Les fichiers TypeScript de la RACINE. Ils manquaient (revue 4.8, défaut n°6) : `proxy.ts` — le middleware
 * de Next 16, exécuté sur CHAQUE requête — n'était couvert par aucune garde, pas plus que `next.config.ts`
 * ou un futur `instrumentation.ts`, qui est précisément l'endroit prévu par Next pour démarrer quelque chose
 * au boot du serveur. Trois endroits où poser un rythme parallèle, aucun surveillé.
 */
function fichiersRacine(): string[] {
  return readdirSync(RACINE)
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".d.ts"))
    .map((f) => join(RACINE, f))
    .filter((f) => statSync(f).isFile());
}

const SOURCES = [
  ...fichiersSous("lib"),
  ...fichiersSous("app"),
  ...fichiersSous("render"),
  ...fichiersRacine(),
];

/**
 * La surface où un RYTHME PARALLÈLE peut naître — plus large que `SOURCES` (Story 6.1, T10).
 *
 * ⚠️ `SOURCES` ne balaie que `.ts`/`.tsx` sous `lib`, `app`, `render` et la racine. Or **la 6.2
 * apporte le web push**, donc un service worker — un fichier `.js` servi depuis `public/`, qui n'est
 * balayé par RIEN. Un service worker est exactement l'endroit d'où poser un rythme : il survit à la
 * fermeture de l'onglet, il a `periodicSync`, et il est invisible du serveur.
 *
 * La garde censée « casser le build » quand un mécanisme périodique apparaît hors de l'ordonnanceur
 * était donc aveugle **précisément là où l'Epic 6 posera son premier mécanisme périodique**.
 *
 * `scripts/` s'ajoute pour la même raison : deux `.mjs` y vivent déjà, exécutables à la main comme
 * par un runner, et hors de toute garde.
 */
const EXTENSIONS_RYTHME = [".js", ".mjs", ".cjs", ".ts", ".tsx"];

/**
 * ⚠️ Une FONCTION, pas une constante : l'anti-vacuité pose une sonde sur le disque et doit pouvoir
 * la voir apparaître. Une liste figée à l'import ne verrait jamais rien changer — et un test qui
 * prouve la capacité de balayage sur une liste qu'il ne relit pas ne prouve rien.
 */
function surfaceRythme(): string[] {
  return [
    ...SOURCES,
    ...(existsSync(resolve(RACINE, "public")) ? fichiersSous("public", EXTENSIONS_RYTHME) : []),
    ...(existsSync(resolve(RACINE, "scripts")) ? fichiersSous("scripts", EXTENSIONS_RYTHME) : []),
  ];
}

const SURFACE_RYTHME = surfaceRythme();

/**
 * Le vocabulaire du rythme CÔTÉ CLIENT, que `setInterval` seul ne couvre pas.
 *
 * `periodicSync` / `registerPeriodicSync` sont l'API de rythme d'un service worker ; `showTrigger`
 * programme une notification pour plus tard sans que le serveur en sache rien ; et un `setTimeout`
 * qui se rappelle lui-même est un `setInterval` qui a changé de nom — le contournement le plus
 * évident de la garde existante.
 */
function rythmeParallele(source: string): string[] {
  const propre = sansCommentaires(source);
  const trouves: string[] = [];
  for (const motif of [/\bsetInterval\s*\(/, /\bperiodicSync\b/, /\bregisterPeriodicSync\s*\(/, /\bshowTrigger\b/]) {
    if (motif.test(propre)) trouves.push(motif.source);
  }
  // Le `setTimeout` récursif : une fonction nommée qui se rappelle depuis son propre `setTimeout`.
  //
  // ⚠️ LES FORMES D'AFFECTATION COMPTENT AUTANT QUE LE MOT-CLÉ `function` (corrigé en revue). La
  // version initiale ne connaissait que `function nom(...)`. Or un service worker — l'objet même
  // pour lequel cette surface a été élargie — s'écrit en fonctions fléchées :
  //
  //     const battre = () => { rafraichir(); setTimeout(battre, 3_600_000); };
  //
  // …et passait intégralement sous le radar. Le contrôle `[MÉTA]` n'exerçait que la forme couverte,
  // ce qui donnait exactement l'impression inverse : un détecteur vérifié, donc complet.
  const nommees = [
    ...[...propre.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]),
    ...[
      ...propre.matchAll(
        // Une VRAIE définition de fonction, et rien d'autre : `= function`, `= (…) =>`, `= x =>`.
        // ⚠️ Ne PAS accepter `= <identifiant>` : `const r = absorberDelta(…)` ferait alors de `r` un
        // nom de fonction candidat, et le `setTimeout(r, ms)` d'un sommeil ponctuel — un resolveur de
        // promesse, pas un rythme — rougirait. Faux positif attrapé en revue sur
        // `app/api/anam/message/route.ts`. Une garde qui rougit sur du code sain finit toujours par
        // être désactivée, et c'est comme ça qu'on perd une vraie garde.
        /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g,
      ),
    ].map((m) => m[1]),
  ];
  for (const nom of new Set(nommees)) {
    const dansUnTimeout = new RegExp(`setTimeout\\s*\\(\\s*(?:\\(\\s*\\)\\s*=>\\s*)?${nom}\\b`);
    if (dansUnTimeout.test(propre)) trouves.push(`setTimeout récursif (${nom})`);
  }
  return trouves;
}

/**
 * Un déclencheur périodique dans un workflow GitHub Actions. La menace était NOMMÉE par le commentaire de
 * la garde des routes (« un service externe, GitHub Actions… ») et n'était vérifiée nulle part : rien
 * n'empêchait d'ajouter à `ci.yml` un `on: schedule:` qui appelle une route avec un `curl`. Ce serait un
 * second ordonnanceur complet — hors registre, hors `vercel.json`, et hors de toute idempotence.
 */
function declencheurPeriodique(yaml: string): boolean {
  return /^\s*schedule:\s*$/m.test(yaml) || /^\s*-?\s*cron:\s*\S/m.test(yaml);
}

/**
 * La définition COURANTE d'une fonction SQL — celle que la base exécute, pas celle qu'un fichier
 * porte encore (Story 6.1, AC8).
 *
 * Les migrations sont immuables et forward-only : une fonction redéfinie par une migration
 * ultérieure laisse dans son fichier d'origine une version périmée, à jamais lisible et à jamais
 * fausse. Une garde qui lit ce fichier-là vérifie une définition MORTE — elle est verte pour
 * toujours, quoi qu'on fasse à la fonction vivante.
 *
 * On retient donc le plus haut numéro parmi les fichiers qui définissent la fonction. Le nom du
 * fichier retenu part dans le message d'échec : sans lui, un test rouge n'apprendrait pas OÙ
 * regarder, ce qui est exactement le moment où on en a besoin.
 *
 * ⚠️ Réutilisable, et une seule chaîne l'utilise aujourd'hui (`sante_ordonnanceur_publique`).
 * L'audit des seize gardes du dépôt ancrées sur un numéro de migration est consigné dans
 * `deferred-work.md` : toutes ne sont pas des défauts — lire un numéro est légitime quand la garde
 * atteste un FAIT HISTORIQUE, et fautif quand elle prétend vérifier une propriété VIVANTE.
 */
function definitionCourante(nomFonction: string): { fichier: string; source: string } {
  const motif = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${nomFonction}\\b`, "i");
  const definitions = fichiersSous(join("supabase", "migrations"), [".sql"])
    .filter((f) => motif.test(readFileSync(f, "utf-8")))
    .sort();

  // Anti-vacuité : un renommage de la fonction rendrait ce test MUET et vert — il ne lirait plus
  // aucun fichier et n'assérerait plus rien. C'est la façon la plus discrète de perdre une garde.
  expect(
    definitions.length,
    `aucune migration ne définit \`public.${nomFonction}\` — la garde ne lit plus rien`,
  ).toBeGreaterThanOrEqual(1);

  // Le tri lexicographique EST le tri numérique : les migrations sont préfixées sur quatre chiffres.
  const retenu = definitions[definitions.length - 1];
  return { fichier: retenu.slice(RACINE.length + 1), source: readFileSync(retenu, "utf-8") };
}

/**
 * ── L'EXPRESSION CRON, LUE POUR SA VALEUR ET NON POUR SA FORME (Story 6.1, AC7) ────────────────
 *
 * La garde d'origine n'exigeait que **cinq champs séparés par des espaces**. Une expression toutes
 * les cinq minutes la satisfaisait intégralement : douze ticks par heure, sur un palier qui en
 * autorise **un par jour** — et sur `hobby` une telle expression ne dégrade pas, elle **fait échouer
 * le déploiement**. La CI doit le dire avant Vercel.
 *
 * On ne prend pas de dépendance pour ça : trois petites fonctions, et un contrôle `[MÉTA]` sur des
 * cas connus. Une bibliothèque de cron non testée ici serait une garde dont on ignore le sens.
 */
function champsCron(schedule: string): Set<number>[] {
  // ⚠️ Le jour de semaine monte à 7, et non à 6 : en sémantique Vixie, dimanche s'écrit `0` OU `7`.
  //
  // ⚠️ MAIS CETTE BORNE EST INERTE, et c'est la campagne de mutation qui l'a établi : la ramener à 6
  // ne fait rougir AUCUN test. La raison est que `max` ne sert qu'à l'expansion de `*` et de `*/n` —
  // un littéral explicite comme `7` fixe `debut = fin = Number("7")` et passe à côté de la borne ; et
  // pour `*`, la normalisation ci-dessous replie 7 sur 0, ce qui rend le même ensemble dans les deux
  // cas. **Mutant équivalent, documenté et non masqué** (`deferred-work.md`).
  //
  // Ce qui porte réellement la sémantique, c'est la NORMALISATION `7 → 0` de la boucle : la retirer
  // tue le test `30 3 * * 7`. La borne reste à 7 parce qu'elle dit juste ce que le champ accepte —
  // pas parce qu'une garde en dépend.
  const bornes: [number, number][] = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 7],
  ];
  const champs = schedule.trim().split(/\s+/);
  expect(champs, `\`${schedule}\` doit avoir cinq champs`).toHaveLength(5);

  return champs.map((champ, i) => {
    const [min, max] = bornes[i];
    const valeurs = new Set<number>();
    for (const terme of champ.split(",")) {
      const [plage, pasBrut] = terme.split("/");
      const pas = pasBrut ? Number(pasBrut) : 1;
      // ⚠️ Un pas nul ou négatif faisait BOUCLER À L'INFINI (corrigé en revue) : le test PENDAIT au
      // lieu de rougir, ce qui est la pire façon d'échouer — on croit à une lenteur de CI.
      expect(Number.isInteger(pas) && pas >= 1, `\`${schedule}\` : pas invalide \`/${pasBrut}\``).toBe(true);
      let debut = min;
      let fin = max;
      if (plage !== "*") {
        const [a, b] = plage.split("-");
        debut = Number(a);
        fin = b === undefined ? (pasBrut ? max : Number(a)) : Number(b);
      }
      for (let v = debut; v <= fin; v += pas) valeurs.add(i === 4 && v === 7 ? 0 : v);
    }
    return valeurs;
  });
}

/** Les instants UTC où l'expression se déclenche, sur `[debut, fin[`. */
function ticksUtc(schedule: string, debut: Date, fin: Date): Date[] {
  const [minutes, heures, jours, mois, joursSemaine] = champsCron(schedule);
  // Sémantique Vixie : quand jour-du-mois ET jour-de-semaine sont tous deux restreints, c'est un OU.
  // Nos expressions ont `*` des deux côtés ; la règle est implémentée pour ne pas mentir si ça change.
  const jourRestreint = jours.size < 31;
  // 7 valeurs distinctes après normalisation de `7` en `0` — pas 8.
  const semaineRestreinte = joursSemaine.size < 7;

  const trouves: Date[] = [];
  for (let t = debut.getTime(); t < fin.getTime(); t += 60_000) {
    const d = new Date(t);
    if (!minutes.has(d.getUTCMinutes()) || !heures.has(d.getUTCHours())) continue;
    if (!mois.has(d.getUTCMonth() + 1)) continue;
    const parJour = jours.has(d.getUTCDate());
    const parSemaine = joursSemaine.has(d.getUTCDay());
    const jourOk =
      jourRestreint && semaineRestreinte ? parJour || parSemaine : jourRestreint ? parJour : semaineRestreinte ? parSemaine : true;
    if (jourOk) trouves.push(d);
  }
  return trouves;
}

/** Le plus petit écart, en SECONDES, entre deux déclenchements consécutifs — le pire cas. */
function intervalleMinimalDuCron(schedule: string): number {
  // ⚠️ LA FENÊTRE DOIT FRANCHIR DES FRONTIÈRES DE MOIS. La version initiale partait du 1er janvier
  // sur 28 jours — elle n'en franchissait AUCUNE, pendant que son propre commentaire certifiait
  // qu'« un `1-31/2` montre bien son resserrement de fin de mois ». C'était faux : les jours impairs
  // sont espacés de deux jours DANS un mois, et d'un seul jour au passage du 31 au 1er. La fonction
  // sur-estimait donc l'intervalle de toute expression restreinte sur le jour du mois — et une
  // sur-estimation est exactement ce qui rend une garde de plafond trop permissive.
  //
  // Soixante-dix jours depuis le 25 janvier : trois passages de mois, dont un février de 28 jours.
  const debut = new Date("2026-01-25T00:00:00Z");
  const ticks = ticksUtc(schedule, debut, new Date(debut.getTime() + 70 * 86_400_000));
  expect(ticks.length, `\`${schedule}\` ne se déclenche jamais — anti-vacuité`).toBeGreaterThanOrEqual(2);

  let minimum = Infinity;
  for (let i = 1; i < ticks.length; i++) {
    minimum = Math.min(minimum, (ticks[i].getTime() - ticks[i - 1].getTime()) / 1000);
  }
  return minimum;
}

const CHEMIN_VERCEL = resolve(RACINE, "vercel.json");

/**
 * Le schedule réellement déployé — lu, jamais recopié.
 *
 * ⚠️ `existsSync` d'abord : sans lui la garde casserait en `ENOENT` plutôt que de rougir, et un
 * fichier disparu ressemblerait à une panne d'outillage. Ce n'est pas théorique — voir la porte
 * d'hébergement (`PORTES-AVANT-PUBLICATION.md` §2) : le jour où l'ordonnanceur déménage, ce fichier
 * peut cesser d'exister, et ces gardes doivent alors dire ce qui se passe.
 */
function scheduleDeLOrdonnanceur(): string {
  expect(existsSync(CHEMIN_VERCEL), "`vercel.json` doit exister pour que ces gardes veuillent dire quelque chose").toBe(
    true,
  );
  const vercel = JSON.parse(readFileSync(CHEMIN_VERCEL, "utf-8")) as { crons?: { schedule: string }[] };
  expect(vercel.crons?.length, "anti-vacuité : sans cron déclaré, ces gardes ne mesurent rien").toBeGreaterThanOrEqual(
    1,
  );
  return vercel.crons![0].schedule;
}

/** La date civile Paris d'un instant — c'est elle que `fenetreDe` utilise comme clé de fenêtre. */
const dateCivileParis = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

describe("[MÉTA] la garde de commentaires fonctionne dans les DEUX sens", () => {
  it("[6.1/AC8] `definitionCourante` retient la PLUS HAUTE migration, pas la première", () => {
    // Sans ce contrôle, `definitionCourante` pourrait rendre n'importe laquelle des trois définitions
    // et la garde d'en dessous resterait verte — on aurait remplacé un numéro figé par une fonction
    // qui se trompe, ce qui est pire parce que ça a l'air d'être réparé.
    //
    // Mutation-cible : prendre `definitions[0]` au lieu du dernier.
    //
    // ⚠️ L'attendu était écrit « 0031 » en dur, et la 6.1a l'a fait rougir en ajoutant une quatrième
    // définition. Le figer de nouveau sur « 0052 » reconstruirait exactement la fragilité que
    // `definitionCourante` existe pour tuer. On RECALCULE donc l'attendu, par un chemin délibérément
    // plus bête — une recherche de sous-chaîne, sans expression rationnelle — pour que les deux
    // implémentations ne puissent pas se tromper ensemble.
    const dossier = resolve(RACINE, "supabase", "migrations");
    const definissantes = readdirSync(dossier)
      .filter((f) =>
        readFileSync(resolve(dossier, f), "utf-8").includes(
          "create or replace function public.sante_ordonnanceur_publique",
        ),
      )
      .sort();
    expect(definissantes.length, "0027, 0028, 0031 et 0052 la définissent").toBeGreaterThanOrEqual(4);

    const { fichier } = definitionCourante("sante_ordonnanceur_publique");
    expect(fichier, "c'est la PLUS HAUTE qui gagne").toContain(definissantes[definissantes.length - 1]);
  });

  it("elle efface une mention en commentaire et conserve le code réel", () => {
    // Sans ce test, la garde ci-dessous pourrait être aveugle (tout effacer → jamais rouge) ou bavarde
    // (ne rien effacer → rouge sur une phrase d'explication) sans que rien ne le dise. La leçon de 4.6 :
    // une garde textuelle qu'on ne teste pas est une garde dont on ignore le sens.
    const source = ["// on n'utilise pas setInterval ici", "/* setInterval non plus */", "setInterval(f, 1);"].join(
      "\n",
    );
    const nettoye = sansCommentaires(source);
    expect((nettoye.match(/setInterval/g) ?? []).length, "exactement l'occurrence de CODE").toBe(1);

    // ⚠️ Et le commentaire de FIN DE LIGNE, ajouté en revue : il échappait entièrement au nettoyage.
    expect(sansCommentaires("clore(a); // ici on clore avec e.message"), "la fin de ligne aussi").toBe("clore(a); ");
    // …sans amputer une URL, qui est le faux positif évident de cette correction.
    expect(sansCommentaires('const u = "https://exemple.fr/x";'), "une URL reste entière").toContain(
      "https://exemple.fr/x",
    );
  });
});

describe("[AC1/AC4] il n'existe qu'UN mécanisme périodique dans ce dépôt", () => {
  it("`vercel.json` déclare EXACTEMENT un cron, et il pointe sur la porte unique", () => {
    // Mutation-cible : ajouter une seconde entrée `crons` pour un job « juste celui-là, il est petit ».
    // C'est toujours comme ça qu'un ordonnanceur unique cesse de l'être.
    //
    // ⚠️ `toHaveLength(1)` reste, et la Story 6.1 n'y touche pas : elle n'ajoute aucun tick, et sur
    // le palier `hobby` elle ne le pourrait pas. L'assouplissement appartient à la 6.2, avec le job
    // qui en aura besoin.
    expect(existsSync(CHEMIN_VERCEL), "sans ce fichier, la garde casserait en ENOENT au lieu de rougir").toBe(true);
    const vercel = JSON.parse(readFileSync(CHEMIN_VERCEL, "utf-8")) as {
      crons?: { path: string; schedule: string }[];
    };
    expect(vercel.crons, "vercel.json doit déclarer les crons").toBeDefined();
    expect(vercel.crons).toHaveLength(1);
    expect(vercel.crons![0].path).toBe("/api/ordonnanceur");
    expect(vercel.crons![0].schedule, "une expression cron valide à 5 champs").toMatch(/^\S+( \S+){4}$/);
  });

  it("AUCUN mécanisme de rythme parallèle — ni serveur, ni client, ni service worker", () => {
    // Le cas client compte autant que le serveur : une tâche périodique déclenchée par le navigateur est
    // un second rythme, non possédé, non idempotent, et invisible du côté serveur. L'AC1 le nomme
    // explicitement (« ni tâche déclenchée côté client »).
    //
    // ⚠️ Story 6.1 — la garde ne voyait que `setInterval`, et seulement sous `lib`/`app`/`render`.
    // Deux angles morts, et la 6.2 tombe pile dedans : le web push apporte un service worker, servi
    // depuis `public/` en `.js`, avec `periodicSync` — un rythme qui survit à la fermeture de
    // l'onglet et qu'aucune de ces gardes n'aurait vu.
    //
    // Mutation-cible : poser `setInterval(…)` ou `periodicSync` dans un `public/sw.js`.
    const fautifs = surfaceRythme().flatMap((f) => {
      const trouves = rythmeParallele(readFileSync(f, "utf-8"));
      return trouves.length ? [`${f.slice(RACINE.length + 1)} — ${trouves.join(", ")}`] : [];
    });
    expect(fautifs, "un seul ordonnanceur, et il est dans le registre").toEqual([]);
  });

  it("[MÉTA/6.1] le détecteur de rythme rougit sur chaque forme, et se tait sur les mentions", () => {
    // Contrôle positif/négatif obligatoire : sans lui, `rythmeParallele` pourrait être aveugle sur
    // trois de ses quatre motifs sans que la garde ci-dessus ne dise quoi que ce soit — elle serait
    // verte, comme elle l'est aujourd'hui, mais pour une autre raison.
    expect(rythmeParallele("setInterval(f, 1000);"), "l'intervalle nu").toHaveLength(1);
    expect(rythmeParallele("registration.periodicSync.register('x');"), "le rythme du service worker").toHaveLength(1);
    expect(rythmeParallele("await reg.periodicSync.register('maj', { minInterval: 86400000 });")).toHaveLength(1);
    expect(rythmeParallele("n.showTrigger = new TimestampTrigger(t);"), "la notification programmée").toHaveLength(1);
    expect(rythmeParallele("function boucler() { setTimeout(boucler, 60000); }"), "le timeout récursif").toHaveLength(
      1,
    );
    // ⚠️ Les trois formes qui manquaient, et c'est celle du milieu qu'un service worker emploie.
    expect(
      rythmeParallele("const battre = () => { rafraichir(); setTimeout(battre, 3600000); };"),
      "la fonction FLÉCHÉE qui se rappelle — la forme d'un service worker",
    ).toHaveLength(1);
    expect(
      rythmeParallele("const battre = async () => { setTimeout(() => battre(), 60000); };"),
      "fléchée, asynchrone, et rappelée dans une lambda",
    ).toHaveLength(1);
    expect(
      rythmeParallele("const battre = function () { setTimeout(battre, 60000); };"),
      "la fonction anonyme affectée",
    ).toHaveLength(1);

    // Et le silence sur ce qui n'est pas un mécanisme — la leçon de 4.6 et 4.7, appliquée ici.
    expect(rythmeParallele("// on n'utilise pas setInterval ici"), "une mention en commentaire").toEqual([]);
    expect(rythmeParallele("/* periodicSync serait un second rythme */"), "une explication en bloc").toEqual([]);
    expect(rythmeParallele("setTimeout(() => fermer(), 300);"), "un timeout SIMPLE n'est pas un rythme").toEqual([]);
    // ⚠️ Le faux positif attrapé en revue, figé ici pour qu'une réécriture ne le rouvre pas : un
    // sommeil ponctuel passe son RESOLVEUR à `setTimeout`. Ce n'est pas un rythme, et le nom `r` n'est
    // pas une fonction — c'est le résultat d'un appel, ailleurs dans le même fichier.
    expect(
      rythmeParallele("const attendre = (ms) => new Promise((r) => setTimeout(r, ms));\nconst r = calculer();"),
      "un sommeil ponctuel n'est pas un rythme",
    ).toEqual([]);
  });

  it("[ANTI-VACUITÉ] un service worker fautif dans `public/` FAIT ROUGIR la garde", () => {
    // ⚠️ CE TEST NE VÉRIFIAIT PAS `public/` (corrigé en revue), c'est-à-dire précisément le seul
    // endroit pour lequel la surface a été élargie. Ses trois assertions portaient sur la taille
    // totale (satisfaite par les deux `.mjs` de `scripts/`), sur `scripts/`, et sur la présence de
    // `.js` dans un tableau littéral comparé à lui-même. Supprimer la branche `public/` de
    // `SURFACE_RYTHME` laissait les 41 tests verts — `public/` ne contenant aujourd'hui aucun `.js`,
    // rien ne distinguait « balayée » de « supprimée ». Une faute de frappe sur le nom du dossier
    // aurait produit le même silence, et la 6.2 aurait posé son `public/sw.js` sous une garde verte.
    //
    // On ne vérifie donc plus un COMPTAGE, on vérifie la CAPACITÉ : on pose une sonde fautive là où
    // le service worker ira, et on exige qu'elle soit vue.
    const sonde = resolve(RACINE, "public", "sonde-rythme.js");
    expect(existsSync(sonde), "la sonde ne doit pas préexister").toBe(false);
    try {
      writeFileSync(sonde, "self.addEventListener('install', () => {});\nsetInterval(() => fetch('/x'), 60000);\n");
      const surface = surfaceRythme();
      const vus = surface.filter((f) => rythmeParallele(readFileSync(f, "utf-8")).length > 0);
      expect(
        vus.map((f) => f.slice(RACINE.length + 1)),
        "un `setInterval` posé dans `public/` doit être VU — c'est là que la 6.2 posera son service worker",
      ).toEqual([join("public", "sonde-rythme.js")]);
    } finally {
      // Sans ce nettoyage, un échec du `expect` laisserait la sonde en place et TOUS les prochains
      // lancements rougiraient — y compris ceux d'un dépôt sain.
      if (existsSync(sonde)) rmSync(sonde);
    }
    expect(existsSync(sonde), "et la sonde est retirée, quoi qu'il arrive").toBe(false);
  });

  it("[ANTI-VACUITÉ] la surface couvre aussi `scripts/`, et elle dépasse `SOURCES`", () => {
    expect(SURFACE_RYTHME.length, "elle doit être STRICTEMENT plus large que `SOURCES`").toBeGreaterThan(
      SOURCES.length,
    );
    expect(
      SURFACE_RYTHME.some((f) => f.includes(`${join("scripts", "")}`)),
      "les deux `.mjs` de `scripts/` sont balayés",
    ).toBe(true);
  });

  it("[MÉTA] le détecteur de cron GitHub Actions rougit sur un vrai cas et se tait sur le reste", () => {
    // Sans ce contrôle positif, la garde ci-dessous serait peut-être simplement aveugle — et un test
    // aveugle est vert pour toujours. La leçon de 4.6, appliquée à un troisième détecteur textuel.
    expect(declencheurPeriodique("on:\n  schedule:\n    - cron: '0 6 * * *'\n"), "un vrai cron").toBe(true);
    expect(declencheurPeriodique("on:\n  push:\n    branches: [main]\n"), "un push, non").toBe(false);
    expect(declencheurPeriodique("# schedule: rien ici\njobs:\n  schedule-doc:\n"), "un nom, non").toBe(false);
  });

  it("AUCUN workflow GitHub Actions ne déclare de déclencheur périodique", () => {
    const dossier = resolve(RACINE, ".github", "workflows");
    const fichiers = existsSync(dossier) ? readdirSync(dossier).filter((f) => /\.ya?ml$/.test(f)) : [];
    // Anti-vacuité : une garde qui ne lit aucun fichier passe toujours. Si les workflows déménagent, ce
    // test doit rougir plutôt que devenir silencieusement décoratif.
    expect(fichiers.length, "il doit y avoir au moins un workflow à inspecter").toBeGreaterThan(0);
    const fautifs = fichiers.filter((f) => declencheurPeriodique(readFileSync(join(dossier, f), "utf-8")));
    expect(fautifs, "un `on: schedule:` est un second ordonnanceur, invisible du registre").toEqual([]);
  });

  it("AUCUN cron dans les migrations — l'ordonnanceur n'est pas dans Postgres", () => {
    // `pg_cron` est la tentation évidente pour un job de base de données. Elle créerait un SECOND
    // ordonnanceur, invisible depuis le code, hors du registre, et incapable d'atteindre le port IA dont
    // dépendra la synthèse (4.9).
    const fautifs = fichiersSous("supabase/migrations", [".sql"])
      .filter((f) => /pg_cron|cron\.schedule/i.test(readFileSync(f, "utf-8")))
      .map((f) => f.slice(RACINE.length + 1));
    expect(fautifs).toEqual([]);
  });

  it("le répartiteur n'a qu'UN SEUL appelant applicatif : la porte", () => {
    // Mutation-cible : appeler `executerOrdonnanceur` depuis une autre route (« pour déclencher à la
    // main »). Chaque appelant supplémentaire est une porte de plus à authentifier — et celle qu'on
    // oubliera.
    const appelants = SOURCES.filter((f) => !f.endsWith(join("lib", "ordonnanceur", "executer.ts")))
      .filter((f) => /\bexecuterOrdonnanceur\s*\(/.test(sansCommentaires(readFileSync(f, "utf-8"))))
      .map((f) => f.slice(RACINE.length + 1));
    expect(appelants).toEqual([join("app", "api", "ordonnanceur", "route.ts")]);
  });

  it("`CRON_SECRET` n'est lu que par la porte", () => {
    const lecteurs = SOURCES.filter((f) => /CRON_SECRET/.test(sansCommentaires(readFileSync(f, "utf-8")))).map((f) =>
      f.slice(RACINE.length + 1),
    );
    expect(lecteurs).toEqual([join("app", "api", "ordonnanceur", "route.ts")]);
  });

  it("aucune AUTRE route ne se présente comme un point d'entrée périodique", () => {
    // Mutation-cible : créer `app/api/cron/synthese/route.ts`. La garde `vercel.json` ne suffirait pas —
    // une route peut être déclenchée par un service externe (GitHub Actions, un ping tiers) sans jamais
    // apparaître dans `vercel.json`. Ici on ferme aussi cette porte-là.
    const suspectes = fichiersSous(join("app", "api"))
      .map((f) => f.slice(RACINE.length + 1))
      .filter((f) => /cron|scheduler|planificateur|tache|job/i.test(f));
    expect(suspectes).toEqual([]);
  });

  it("le registre est la SEULE liste de jobs, et le seul importateur des jobs", () => {
    const importateurs = SOURCES.filter((f) => !f.endsWith(join("lib", "ordonnanceur", "registre.ts")))
      .filter((f) => /from "@\/lib\/ordonnanceur\/jobs\//.test(sansCommentaires(readFileSync(f, "utf-8"))))
      .map((f) => f.slice(RACINE.length + 1));
    expect(importateurs, "un job importé hors du registre est un job qui tourne hors du registre").toEqual([]);
  });
});

/**
 * ── LE VOCABULAIRE FERMÉ DES `motif` / `detail` (Story 6.1, T9 · NFR-022) ──────────────────────
 *
 * Ce qui part en base dans `execution_job.motif_echec` et `incident_systeme.detail` n'est aujourd'hui
 * protégé que **par la longueur** (`0027:111` ≤ 120, `0027:215` ≤ 200). Rien n'empêche un futur job
 * de rétention d'y passer un `detail` libre — et un message d'erreur libre est exactement ce qui
 * ramasse une valeur au passage.
 *
 * Est accepté : un littéral de chaîne SANS interpolation, `null`, un ternaire entre deux tels
 * littéraux, `codeDErreur(...)`, ou une variable que le fichier affecte depuis `codeDErreur(...)` —
 * `codeDErreur` étant précisément la fonction dont le rôle est de ne laisser passer que des codes.
 *
 * Est refusé : une interpolation, une concaténation, une variable de provenance inconnue. Aucune
 * n'est mauvaise en soi ; c'est qu'aucune garde ne peut savoir ce qui s'y trouvera plus tard.
 *
 * *(La contrainte `CHECK` de forme en base — la vraie défense, celle qui survit à un appelant qui
 * n'a pas lu ce test — arrive en 6.1a avec la migration `0052`.)*
 */
function litteralFerme(a: string): boolean {
  return a === "null" || /^"[^"$\\]*"$/.test(a) || /^'[^'$\\]*'$/.test(a) || /^`[^`$\\]*`$/.test(a);
}

/**
 * `nom(...)` occupe-t-il l'expression ENTIÈRE ?
 *
 * ⚠️ Corrigé en revue de la 6.1, et c'est le défaut le plus grave qu'elle a trouvé : la version
 * initiale testait `/^codeDErreur\s*\(/`, c'est-à-dire seulement le DÉBUT. `codeDErreur(e) + ": " +
 * branche.nom` passait donc intégralement — une concaténation suffisait à faire partir une valeur
 * libre en base, sous une garde verte écrite pour l'empêcher.
 */
function estAppelEntier(a: string, nom: string): boolean {
  const debut = new RegExp(`^${nom}\\s*\\(`).exec(a);
  if (!debut) return false;
  let profondeur = 0;
  for (let i = debut[0].length - 1; i < a.length; i++) {
    if (a[i] === "(") profondeur++;
    else if (a[i] === ")") {
      profondeur--;
      // La parenthèse fermante correspondante doit être le DERNIER caractère : tout ce qui suit est
      // une opération sur le résultat, donc une valeur que `codeDErreur` n'a pas assainie.
      if (profondeur === 0) return i === a.length - 1;
    }
  }
  return false;
}

function argumentFerme(argument: string, variablesDeCode: ReadonlySet<string>): boolean {
  const a = argument.trim();
  if (litteralFerme(a)) return true;
  if (estAppelEntier(a, "codeDErreur")) return true;
  if (variablesDeCode.has(a)) return true;
  // Un ternaire dont les DEUX branches sont des littéraux fermés (patron de `sante.ts:85`).
  const ternaire = a.match(/\?([^?:]+):([^?:]+)$/);
  if (ternaire) return litteralFerme(ternaire[1].trim()) && litteralFerme(ternaire[2].trim());
  return false;
}

/**
 * Les identifiants que le fichier affecte depuis `codeDErreur(...)` — donc déjà assainis.
 *
 * ⚠️ Une RÉAFFECTATION depuis autre chose SALIT le nom pour tout le fichier. Corrigé en revue : la
 * version initiale blanchissait un nom dès UNE affectation depuis `codeDErreur`, et ne suivait rien
 * ensuite. `let code = codeDErreur(e); … code = e.message;` passait donc — le nom restait « assaini »
 * quoi qu'on lui mette après, ce qui est la façon la plus simple de contourner cette garde sans même
 * le faire exprès.
 *
 * L'analyse reste textuelle et donc grossière ; elle penche du bon côté (elle salit trop plutôt que
 * pas assez). La vraie défense — la contrainte `CHECK` de forme en base, qui survit à un appelant
 * qui n'a jamais lu ce fichier — arrive en 6.1a.
 */
function variablesDeCode(source: string): Set<string> {
  const assainies = new Set(
    [...source.matchAll(/(?:const|let|var)?\s*([A-Za-z_$][\w$]*)\s*=\s*codeDErreur\s*\(/g)].map((m) => m[1]),
  );
  for (const [, nom, valeur] of source.matchAll(/([A-Za-z_$][\w$]*)\s*=\s*(?!=)([^;\n]*)/g)) {
    if (assainies.has(nom) && !/^\s*codeDErreur\s*\(/.test(valeur)) assainies.delete(nom);
  }
  return assainies;
}

/**
 * Le dernier argument d'un appel `nom(...)`, en respectant les parenthèses imbriquées.
 *
 * ⚠️ La VIRGULE FINALE d'un appel multi-lignes est le piège, et il a mordu à l'écriture : découper
 * sur la dernière virgule de profondeur 1 rendait une chaîne VIDE pour `sante.ts`, que
 * `argumentFerme` refusait — une garde rouge sur du code parfaitement sain. On collecte donc tous
 * les arguments et on retient le dernier NON VIDE.
 */
/**
 * Tous les arguments de chaque appel à `nomAppel`, dans l'ordre — l'extracteur brut sur lequel
 * reposent `dernierArgument` et `argumentsAuRang`.
 */
function appelsDe(source: string, nomAppel: string): string[][] {
  const trouves: string[][] = [];
  const motif = new RegExp(`\\b${nomAppel}\\s*\\(`, "g");
  for (const debut of [...source.matchAll(motif)]) {
    let profondeur = 0;
    let i = debut.index! + debut[0].length - 1;
    let curseur = i;
    const arguments_: string[] = [];
    for (; i < source.length; i++) {
      const c = source[i];
      if (c === "(" || c === "[" || c === "{") profondeur++;
      else if (c === ")" || c === "]" || c === "}") {
        profondeur--;
        if (profondeur === 0) {
          arguments_.push(source.slice(curseur + 1, i).trim());
          break;
        }
      } else if (c === "," && profondeur === 1) {
        arguments_.push(source.slice(curseur + 1, i).trim());
        curseur = i;
      }
    }
    const nonVides = arguments_.filter((a) => a.length > 0);
    if (nonVides.length > 0) trouves.push(nonVides);
  }
  return trouves;
}

function dernierArgument(source: string, nomAppel: string): string[] {
  return appelsDe(source, nomAppel).map((args) => args[args.length - 1]);
}

/**
 * ── LA POSITION DU MOTIF SE LIT DANS LE CONTRAT, ELLE NE SE COMPTE PLUS (Story 6.1a) ─────────────
 *
 * La garde du vocabulaire fermé lisait **le dernier argument** de `clore(…)`. C'était juste tant que
 * `motif` était le dernier — et la 6.1a lui ajoute `jeton` derrière. La garde serait restée VERTE en
 * inspectant désormais un uuid : elle aurait cessé de regarder ce qu'elle surveille, sans un mot.
 *
 * C'est la même faute que la lecture d'une migration par son numéro, et elle appelle le même
 * correctif : ne pas figer une position, la **dériver du contrat courant**. Cette fonction lit la
 * signature dans `lib/data/depot-ordonnanceur.ts` et rend le rang du paramètre demandé. Ajouter un
 * argument ne casse plus rien ; renommer `motif` casse la garde **bruyamment**, ce qui est le but.
 *
 * Elle exige en prime que TOUTES les déclarations de la méthode (l'interface et son implémentation)
 * listent les mêmes paramètres dans le même ordre — une couture gratuite, puisque l'extracteur passe
 * déjà sur les deux.
 */
function positionDuParametre(methode: string, nomParametre: string): number {
  const source = sansCommentaires(readFileSync(resolve(RACINE, "lib/data/depot-ordonnanceur.ts"), "utf-8"));
  const declarations = appelsDe(source, methode).map((args) => args.map((a) => a.split(":")[0].trim()));

  expect(
    declarations.length,
    `aucune déclaration de \`${methode}\` dans le dépôt — la garde ne lit plus rien`,
  ).toBeGreaterThanOrEqual(2);
  for (const noms of declarations) {
    expect(noms, `toutes les déclarations de \`${methode}\` doivent lister les mêmes paramètres`).toEqual(
      declarations[0],
    );
  }

  const rang = declarations[0].indexOf(nomParametre);
  expect(rang, `\`${methode}\` n'a plus de paramètre \`${nomParametre}\``).toBeGreaterThanOrEqual(0);
  return rang;
}

describe("[6.1/AC9] ce qui part en base ne peut pas ramasser une valeur au passage", () => {
  it("[MÉTA] le détecteur de vocabulaire fermé rougit sur un vrai cas et se tait sur le reste", () => {
    // Le contrôle positif/négatif obligatoire de ce fichier. Sans lui, la garde ci-dessous pourrait
    // tout accepter (jamais rouge) ou tout refuser (rouge sur du code sain) sans que rien ne le dise.
    const vars = variablesDeCode("const code = codeDErreur(e);");
    expect(vars.has("code"), "une variable affectée depuis `codeDErreur` est assainie").toBe(true);

    expect(argumentFerme('"lot_entierement_echoue"', vars), "un littéral fermé").toBe(true);
    expect(argumentFerme("null", vars), "l'absence de motif").toBe(true);
    expect(argumentFerme("codeDErreur(e)", vars), "l'appel direct").toBe(true);
    expect(argumentFerme("code", vars), "la variable qui en vient").toBe(true);
    expect(argumentFerme('x === null ? "aucune_reussite_connue" : "reussite_hors_tolerance"', vars)).toBe(true);

    // Et ce qu'il doit REFUSER — chacun est un chemin réel par lequel une valeur partirait en base.
    expect(argumentFerme("e.message", vars), "un message d'exception, jamais").toBe(false);
    expect(argumentFerme("`echec_${utilisatriceId}`", vars), "une interpolation, jamais").toBe(false);
    expect(argumentFerme('"echec_" + branche.nom', vars), "une concaténation, jamais").toBe(false);
    expect(argumentFerme("detailLibre", vars), "une variable de provenance inconnue, jamais").toBe(false);

    // ⚠️ LES DEUX CONTOURNEMENTS TROUVÉS EN REVUE, et les seuls qui comptent vraiment : ils faisaient
    // passer une valeur libre sous une garde verte écrite pour l'empêcher.
    expect(
      argumentFerme('codeDErreur(e) + ": " + branche.nom', vars),
      "un code ASSAINI PUIS CONCATÉNÉ — la garde ne regardait que le début de l'expression",
    ).toBe(false);
    expect(argumentFerme("codeDErreur(e).slice(0, 20) + cible", vars), "ni une opération sur le résultat").toBe(false);

    const salies = variablesDeCode("let code = codeDErreur(e);\ncode = e.message;\n");
    expect(
      salies.has("code"),
      "une variable RÉAFFECTÉE depuis autre chose n'est plus assainie — l'analyse suit la dernière écriture",
    ).toBe(false);
  });

  it("[MÉTA] `estAppelEntier` exige que l'appel occupe TOUTE l'expression", () => {
    // La fonction sur laquelle repose la correction du défaut critique. La tester séparément évite
    // que sa réécriture future ne rouvre le trou sans que rien ne le dise.
    expect(estAppelEntier("codeDErreur(e)", "codeDErreur"), "l'appel seul").toBe(true);
    expect(estAppelEntier('codeDErreur(e, "x")', "codeDErreur"), "avec des arguments").toBe(true);
    expect(estAppelEntier("codeDErreur(f(g(e)))", "codeDErreur"), "avec des appels imbriqués").toBe(true);
    expect(estAppelEntier("codeDErreur(e) + x", "codeDErreur"), "suivi de quoi que ce soit : non").toBe(false);
    expect(estAppelEntier("x + codeDErreur(e)", "codeDErreur"), "précédé de quoi que ce soit : non").toBe(false);
    expect(estAppelEntier("autreChose(e)", "codeDErreur"), "un autre appel : non").toBe(false);
  });

  it("[MÉTA] `dernierArgument` sait lire à travers des parenthèses imbriquées", () => {
    // Un extracteur naïf (`split(",")`) couperait au milieu d'un appel imbriqué et rendrait un
    // fragment — que `argumentFerme` refuserait, donnant une garde rouge sur du code sain. On teste
    // donc l'extracteur avant de lui faire confiance.
    expect(dernierArgument('clore(a, b, null, false, codeDErreur(e, "x"));', "clore")).toEqual(['codeDErreur(e, "x")']);
    expect(dernierArgument('leverIncident("job_echoue", n, "fini");', "leverIncident")).toEqual(['"fini"']);
    // ⚠️ La virgule finale d'un appel multi-lignes — le piège qui a fait rougir cette garde sur du
    // code sain à sa première écriture. Sans ce cas, la correction pourrait se perdre à la prochaine
    // réécriture, et personne ne saurait pourquoi elle était là.
    expect(dernierArgument('leverIncident(\n  "a",\n  n,\n  "dernier",\n);', "leverIncident")).toEqual(['"dernier"']);
    // Et un objet en dernier argument : les accolades ne doivent pas être prises pour la fin d'appel.
    expect(dernierArgument('f(a, { code: x });', "f")).toEqual(["{ code: x }"]);
  });

  it("[MÉTA] `positionDuParametre` lit bien le contrat, et rougit s'il change de forme", () => {
    // Sans ce contrôle, la garde du dessous pourrait inspecter le mauvais argument sans que rien ne le
    // dise — l'exacte faute que la 6.1a vient de réparer, une position devenue fausse en silence.
    expect(positionDuParametre("clore", "motif"), "le motif est 5ᵉ").toBe(4);
    expect(positionDuParametre("clore", "jeton"), "et le jeton 6ᵉ, derrière lui").toBe(5);
    expect(positionDuParametre("leverIncident", "detail")).toBe(2);
    // Et ce qu'elle doit REFUSER : un paramètre renommé ou disparu ne se traduit pas par un `-1`
    // silencieux qui ferait lire `args[-1]` — donc `undefined`, donc rien.
    expect(() => positionDuParametre("clore", "raison"), "un nom qui n'existe pas").toThrow();
    expect(() => positionDuParametre("cloreVraiment", "motif"), "une méthode qui n'existe pas").toThrow();
  });

  it("[LE CŒUR] tout `motif` / `detail` de `lib/ordonnanceur/**` sort d'un vocabulaire fermé", () => {
    // ⚠️ En base, l'absence d'art. 9 dans `execution_job.motif_echec` et `incident_systeme.detail` ne
    // fut longtemps structurelle que PAR LA LONGUEUR (≤ 120 et ≤ 200 caractères) : une phrase courte
    // contenant un prénom passait. Depuis la 6.1a, une contrainte de FORME ferme la table elle-même,
    // et `code_reconnu` filtre à l'écriture. Cette garde-ci reste la première des trois, et c'est la
    // seule qui parle à l'auteur du code plutôt qu'à l'exécution : elle nomme le fichier et la ligne.
    //
    // Mutation-cible : passer `e.message` en `detail`, ou interpoler un identifiant de cible.
    const fichiers = fichiersSous(join("lib", "ordonnanceur"));
    expect(fichiers.length, "anti-vacuité : la garde doit avoir des fichiers à lire").toBeGreaterThan(0);

    // Le rang se DÉRIVE du contrat (voir `positionDuParametre`) : `motif` n'est plus le dernier
    // argument de `clore` depuis que le jeton existe, et une garde qui aurait continué de lire « le
    // dernier » serait restée verte en inspectant un uuid.
    const rangs: [string, number][] = [
      ["clore", positionDuParametre("clore", "motif")],
      ["leverIncident", positionDuParametre("leverIncident", "detail")],
    ];

    const fautifs: string[] = [];
    for (const f of fichiers) {
      const source = sansCommentaires(readFileSync(f, "utf-8"));
      const vars = variablesDeCode(source);
      for (const [appel, rang] of rangs) {
        for (const args of appelsDe(source, appel)) {
          const arg = args[rang];
          // Un appel plus court que le contrat n'est pas « rien à inspecter » : c'est un appel qu'on
          // ne comprend plus. On le déclare fautif plutôt que de le SAUTER en silence — sauter est
          // exactement la façon dont une garde cesse de garder.
          if (arg === undefined) fautifs.push(`${f.slice(RACINE.length + 1)} — ${appel}(…) trop court`);
          else if (!argumentFerme(arg, vars)) fautifs.push(`${f.slice(RACINE.length + 1)} — ${appel}(… ${arg})`);
        }
      }
    }
    expect(fautifs, "un `detail` libre est le chemin par lequel une valeur part en base").toEqual([]);
  });

  it("[ANTI-VACUITÉ] la garde lit des appels dans CHACUN des fichiers qui en contiennent", () => {
    // La faute qu'on ne voit jamais : renommer `clore` ou `leverIncident`, et la garde ci-dessus
    // devient verte en n'inspectant plus rien du tout.
    //
    // ⚠️ Compté PAR FICHIER (corrigé en revue). Un seuil global (« au moins six appels ») laisse un
    // cran de mou : un fichier entier peut cesser d'être inspecté sans que le total descende sous le
    // seuil, parce que les autres compensent. Ici on nomme les trois fichiers qui écrivent en base,
    // et chacun doit répondre pour lui-même.
    for (const fichier of ["executer.ts", join("jobs", "sante.ts"), join("jobs", "synthese.ts")]) {
      const source = sansCommentaires(readFileSync(resolve(RACINE, "lib", "ordonnanceur", fichier), "utf-8"));
      const appels = [...dernierArgument(source, "clore"), ...dernierArgument(source, "leverIncident")];
      expect(appels.length, `${fichier} clôture ou lève : la garde doit y voir quelque chose`).toBeGreaterThanOrEqual(
        1,
      );
    }
  });

  it("le chemin du REJEU laisse une trace — il ne se contentait de rien", () => {
    // ⚠️ `executer.ts` poussait `deja_fait` dans le rapport HTTP puis `continue` : RIEN en base (la
    // ligne `execution_job` est celle d'hier, `tentatives` n'est pas incrémenté), RIEN dans les
    // journaux. Le rapport part vers l'ordonnanceur externe et se perd.
    //
    // Sur un rejeu de purge (6.8), il ne resterait donc aucune trace disant « la rétention a été
    // rejouée et n'a rien refait » — or l'absence d'effet EST le résultat attendu, et un résultat
    // attendu qu'on ne peut pas montrer ne vaut pas mieux qu'un travail non fait.
    //
    // Mutation-cible : retirer le `journaliserExploitation` de ce chemin.
    const source = sansCommentaires(readFileSync(resolve(RACINE, "lib/ordonnanceur/executer.ts"), "utf-8"));
    expect(source, "le rejeu doit se dire").toMatch(/journaliserExploitation\(\s*"ordonnanceur_deja_fait"/);
    // Sous `code`, et avec le nom du job : `journaliserExploitation` ne recopie PAS l'objet qu'on lui
    // passe — il en extrait `code` et jette le reste (défaut n°10 de la revue 4.8). Un `{motif,
    // detail}` sortirait en `code: undefined` : l'alerte existerait, vide de sens.
    expect(source).toMatch(/"ordonnanceur_deja_fait",\s*\{\s*code:\s*job\.nom\s*\}/);
  });
});

describe("[AD-1] le domaine de l'ordonnanceur reste pur", () => {
  it("`lib/domain/ordonnanceur.ts` n'importe ni framework, ni infra, ni couche supérieure", () => {
    // La règle ESLint couvre déjà `lib/domain/**`. Ce test la double au niveau du dépôt : une règle de
    // lint se désactive par un commentaire sur une ligne, un test non.
    const source = readFileSync(resolve(RACINE, "lib/domain/ordonnanceur.ts"), "utf-8");
    expect(source).not.toMatch(/from "(next|@supabase|@\/lib\/data|@\/app|@\/render)/);
    expect(source, "et surtout : aucune I/O").not.toMatch(/\bfetch\s*\(|server-only/);
  });

  it("[6.1/AC10] aucun appel de `depot-ordonnanceur.ts` n'est NU", () => {
    // ⚠️ Une marge, même fonction du nombre de jobs, ne protège de rien contre un appel qui PEND.
    // Elle provisionne du temps ; elle ne le reprend pas. Et la panne la plus banale d'une base
    // n'est pas l'erreur, c'est le silence — un `try/catch` n'attrape que des rejets, jamais une
    // attente. Le répartiteur se ferait tuer par la plateforme avant d'avoir rien clos ni levé, la
    // ligne restant `en_cours` sous son bail : un échec totalement muet.
    //
    // Ce défaut a déjà été payé une fois (revue 4.8, défaut n°8) et n'a été corrigé QUE sur
    // `santePublique` — les cinq autres appels sont restés nus jusqu'ici. On répare la classe, pas
    // l'instance : cette garde interdit la rechute.
    //
    // Mutation-cible : retirer un `borne(...)` et rappeler `supabase.rpc` directement.
    const source = sansCommentaires(readFileSync(resolve(RACINE, "lib/data/depot-ordonnanceur.ts"), "utf-8"));
    const nus = [...source.matchAll(/await\s+supabase\s*\.\s*(rpc|from)\s*\(/g)].map((m) => m[0]);
    expect(nus, "tout appel passe par `borne(...)`, qui l'enveloppe d'`avecDelai`").toEqual([]);

    // Anti-vacuité : sans ce compte, supprimer toutes les requêtes du fichier rendrait le test vert.
    const bornes = [...source.matchAll(/borne\(/g)].length;
    expect(bornes, "les cinq méthodes du dépôt doivent être bornées").toBeGreaterThanOrEqual(5);
  });

  it("[MÉTA/6.1] le détecteur d'appel nu rougit sur un vrai cas et se tait sur l'enveloppé", () => {
    // Le contrôle positif/négatif que ce fichier applique déjà à ses trois autres détecteurs
    // textuels. Sans lui, la garde ci-dessus pourrait être simplement aveugle — donc verte pour
    // toujours, et c'est la façon la plus discrète de perdre une garde.
    const nu = (s: string) => [...sansCommentaires(s).matchAll(/await\s+supabase\s*\.\s*(rpc|from)\s*\(/g)].length;
    expect(nu('const x = await supabase.rpc("f");'), "un appel nu").toBe(1);
    expect(nu('const x = await borne(supabase.rpc("f"), "f");'), "un appel enveloppé").toBe(0);
    expect(nu('// await supabase.rpc("f") — mention en commentaire'), "une mention, non").toBe(0);
  });

  it("il n'existe qu'UNE implémentation de `avecDelai` dans le dépôt", () => {
    // Extraite en 4.8 : elle vivait à l'identique dans trois pipelines de sécurité, et l'ordonnanceur en
    // aurait fait une quatrième copie. Une garantie recopiée est une garantie qui finit par diverger d'un
    // seul côté — et ici, le côté qui diverge est celui qui décide d'un repli sûr (AD-15).
    const definitions = SOURCES.filter((f) =>
      /function avecDelai</.test(sansCommentaires(readFileSync(f, "utf-8"))),
    ).map((f) => f.slice(RACINE.length + 1));
    expect(definitions).toEqual([join("lib", "domain", "delai.ts")]);
  });
});

describe("[AC3] la configuration d'environnement est déclarée, pas devinée", () => {
  it("`.env.example` documente `CRON_SECRET` et `ANIMA_ENV`", () => {
    // Un secret non documenté est un secret qu'on oubliera de régler au déploiement — et la porte
    // répondrait alors 503 en silence, ce qui est sûr mais indéchiffrable.
    expect(existsSync(resolve(RACINE, ".env.example"))).toBe(true);
    const exemple = readFileSync(resolve(RACINE, ".env.example"), "utf-8");
    expect(exemple).toMatch(/^CRON_SECRET=/m);
    expect(exemple).toMatch(/^ANIMA_ENV=/m);
  });
});

describe("[AC5] le job de santé est le point fixe du signal public", () => {
  it("le registre déclare bien `sante-ordonnanceur`, QUOTIDIEN — le nom que la SQL code en dur", () => {
    // La clause d'homme mort de `sante_ordonnanceur_publique` (migration 0028) nomme ce job en dur et
    // suppose sa cadence QUOTIDIENNE : c'est ce qui garantit qu'une réussite doit apparaître toutes les
    // 24 h. Le renommer, ou le passer hebdomadaire, rendrait ce prédicat faux EN SILENCE — le signal
    // public dirait `degrade` pour toujours, et personne ne saurait pourquoi. La SQL ne peut pas importer
    // le registre ; ce test est la couture entre les deux.
    const sante = REGISTRE.find((j) => j.nom === "sante-ordonnanceur");
    expect(sante, "le job de santé doit rester au registre").toBeDefined();
    expect(sante!.cadence, "la clause d'homme mort suppose une réussite toutes les 24 h").toBe("quotidien");

    // ⚠️ Story 6.1 — cette garde lisait `0028_sante_homme_mort.sql` PAR SON NUMÉRO, et elle ne pouvait
    // déjà plus rougir. TROIS migrations définissent `sante_ordonnanceur_publique` (0027, 0028, 0031)
    // et c'est 0031 qui gagne ; les migrations étant immuables et forward-only, 0028 contiendra la
    // chaîne attendue POUR TOUJOURS, quoi qu'on fasse à la fonction vivante. On pouvait renommer le
    // job dans 0031 et regarder la CI rester verte.
    //
    // La leçon est générale : **toute garde qui lit une migration par son NUMÉRO est périssable.**
    const { fichier, source } = definitionCourante("sante_ordonnanceur_publique");
    expect(source, `le nom en dur dans ${fichier} et celui du registre sont le même`).toContain(
      `job = '${sante!.nom}'`,
    );
  });

  it("la tolérance de chaque job ne tombe sur AUCUN des deux bords qui la rendraient aléatoire", () => {
    // Revue 4.8, défaut n°9. Une tolérance posée pile sur un bord fait dépendre l'alerte de la dérive
    // de planification, qui se compte en minutes (±59 min sur `hobby`) : la même panne alerte ou non
    // selon le hasard de l'horaire. On exige donc que la tolérance tombe au MILIEU d'un intervalle.
    //
    // ⚠️ Story 6.1 — il y a DEUX bords, et l'ancienne garde n'en connaissait qu'un.
    //
    //   • la GRANULARITÉ DE FENÊTRE (`fenetreDe`) : à quel rythme la clé civile change, donc à quel
    //     rythme une réussite PEUT être enregistrée. C'est ce que l'énumération `cadence` dit.
    //   • l'INTERVALLE DE TICK (l'expression cron) : à quel rythme le répartiteur passe, donc à quel
    //     rythme une réussite EST effectivement enregistrée. C'est ce que la 6.1 ajoute.
    //
    // Les deux coïncident aujourd'hui (fenêtre quotidienne, tick quotidien) et divergeront dès que
    // la 6.2 posera un second tick. Ce ne sont pas deux gardes redondantes : ce sont deux bords.
    const intervalleTickH = intervalleMinimalDuCron(scheduleDeLOrdonnanceur()) / 3_600;
    for (const j of REGISTRE) {
      const pasFenetre = j.cadence === "quotidien" ? 24 : 168;
      expect(
        j.toleranceHeures % pasFenetre,
        `${j.nom} : ${j.toleranceHeures} h est pile sur un multiple de la fenêtre (${pasFenetre} h)`,
      ).not.toBe(0);
      expect(
        j.toleranceHeures % intervalleTickH,
        `${j.nom} : ${j.toleranceHeures} h est pile sur un multiple de l'intervalle de tick (${intervalleTickH} h)`,
      ).not.toBe(0);
    }
  });

  it("[6.1a/AC4] la fenêtre d'homme mort tient entre DEUX ticks manqués et TROIS", () => {
    // ⚠️ CETTE ASSERTION NE POUVAIT PAS ÊTRE ÉCRITE AVANT LA 6.1a — elle aurait été rouge. Deux
    // chiffres racontaient la même décision et ne se parlaient pas : le registre avait choisi 60 h
    // pour ne jamais tomber pile sur un multiple de la cadence (défaut n°9 de la revue 4.8), pendant
    // que la SQL gardait 48 h en dur, c'est-à-dire EXACTEMENT deux fois la cadence quotidienne.
    //
    // À 48 h, l'homme mort se joue sur la dérive : deux ticks nominaux consomment déjà 48 h, et la
    // moindre minute de retard du planificateur (±59 min annoncées sur `hobby`) franchit le seuil.
    // La même panne alertait ou non selon l'horaire du jour — ce qui est la définition d'une alarme
    // dont on ne peut rien conclure.
    //
    // La chaîne, dans les deux sens :
    //   • 2 × intervalle + dérive ≤ fenêtre — deux ticks NOMINAUX n'alertent jamais ;
    //   • fenêtre < 3 × intervalle          — trois ticks manqués alertent toujours.
    // Sans la borne haute, « aligner » se réglerait en montant la fenêtre à l'infini : une alarme
    // qu'on n'entend plus est le repli le plus tentant, et le pire.
    //
    // Mutation-cible : remettre `interval '48 hours'` dans la définition courante.
    const { fichier, source } = definitionCourante("sante_ordonnanceur_publique");
    const fenetres = [...source.matchAll(/interval\s+'(\d+)\s+hours?'/gi)].map((m) => Number(m[1]));
    expect(fenetres, `${fichier} doit porter EXACTEMENT une fenêtre d'homme mort`).toHaveLength(1);
    const fenetreH = fenetres[0];

    const intervalleH = intervalleMinimalDuCron(scheduleDeLOrdonnanceur()) / 3_600;
    const deriveH = DERIVE_PLANIFICATION_MS[PALIER] / 3_600_000;
    // La dérive n'est pas un paramètre de réglage : elle est STRICTEMENT POSITIVE sur tout palier,
    // parce qu'aucun ordonnanceur externe ne garantit la minute. La poser à zéro « puisque ça passe »
    // rendrait la chaîne ci-dessous satisfaisable par une fenêtre pile sur deux ticks — c'est-à-dire
    // exactement le 48 h qu'on est en train de retirer.
    expect(DERIVE_PLANIFICATION_MS[PALIER], "aucun planificateur externe n'est à la seconde").toBeGreaterThan(0);
    expect(2 * intervalleH + deriveH, "deux ticks nominaux ne doivent JAMAIS déclencher").toBeLessThanOrEqual(
      fenetreH,
    );
    expect(fenetreH, "…et trois ticks manqués doivent TOUJOURS déclencher").toBeLessThan(3 * intervalleH);

    // La couture, et c'est elle l'AC4 : la SQL et le registre disent le même nombre. La valeur est
    // LUE dans la définition courante, jamais recopiée ici — un littéral `60` en TypeScript serait
    // un troisième endroit où la décision vit, donc un troisième endroit où elle peut périmer.
    const sante = REGISTRE.find((j) => j.nom === "sante-ordonnanceur")!;
    expect(fenetreH, "la fenêtre SQL et la tolérance du registre sont la MÊME décision").toBe(
      sante.toleranceHeures,
    );
  });

  it("chaque job du registre déclare sa date de mise en service", () => {
    // Sans elle, un job ajouté au registre est signalé « en retard » au tick même où il tourne pour la
    // première fois (défaut n°4). Le type l'impose déjà ; ce test empêche la valeur bidon (`new Date(0)`,
    // qui rendrait le repli équivalent à l'ancien).
    for (const j of REGISTRE) {
      expect(j.enServiceDepuis.getTime(), `${j.nom}`).toBeGreaterThan(new Date("2026-01-01").getTime());
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// STORY 6.1 — LA MESURE. Le budget cesse d'être un nombre auto-déclaré et devient une décision du produit.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

const BUDGET = resolve(RACINE, "lib", "domain", "ordonnanceur-budget.ts");

describe("[6.1/AC7] le schedule est vérifié sur sa VALEUR, pas sur sa forme", () => {
  it("[MÉTA] `intervalleMinimalDuCron` donne le bon nombre sur des cas connus", () => {
    // Sans ce contrôle, les trois gardes ci-dessous s'appuieraient sur une fonction dont personne ne
    // connaît le sens — et une garde bâtie sur un calcul faux est pire qu'une garde absente : elle
    // rassure. Les cas sont choisis pour couvrir `*`, `*/n` sur l'heure, et `*/n` sur la minute.
    expect(intervalleMinimalDuCron("0 6 * * *"), "une fois par jour").toBe(86_400);
    expect(intervalleMinimalDuCron("0 */4 * * *"), "toutes les quatre heures").toBe(14_400);
    expect(intervalleMinimalDuCron("*/15 * * * *"), "tous les quarts d'heure").toBe(900);
    expect(intervalleMinimalDuCron("30 3 * * 1"), "tous les lundis").toBe(604_800);
    // Le pire cas, et non la moyenne : `0 6,7 * * *` a deux ticks par jour, dont deux séparés d'une
    // seule heure. C'est ce resserrement-là que les gardes doivent voir.
    expect(intervalleMinimalDuCron("0 6,7 * * *"), "le PLUS PETIT écart, pas l'écart moyen").toBe(3_600);

    // ⚠️ LE CAS QUI A RÉVÉLÉ LE DÉFAUT DE LA FENÊTRE (revue de la 6.1). Les jours impairs sont
    // espacés de deux jours à l'intérieur d'un mois, et d'UN SEUL au passage du 31 au 1er. Avec la
    // fenêtre initiale — 28 jours depuis le 1er janvier, qui ne franchissait aucune frontière de
    // mois — cette expression rendait 172 800 au lieu de 86 400 : le double, dans le sens permissif.
    expect(intervalleMinimalDuCron("0 6 1-31/2 * *"), "le resserrement du 31 au 1er").toBe(86_400);

    // Sémantique Vixie : dimanche s'écrit `0` OU `7`. Borner le champ à 6 rendait un ensemble vide,
    // donc zéro tick, donc une garde muette sur une expression valide.
    expect(intervalleMinimalDuCron("30 3 * * 7"), "dimanche écrit `7`").toBe(604_800);
    expect(intervalleMinimalDuCron("30 3 * * 0"), "…et dimanche écrit `0`, identiques").toBe(604_800);
  });

  it("[MÉTA] une expression malformée ROUGIT — elle ne fait pas pendre la CI", () => {
    // ⚠️ Un pas nul faisait boucler `for (let v = debut; v <= fin; v += 0)` à l'infini : le test
    // PENDAIT au lieu d'échouer, et une CI qui pend se lit comme une lenteur, pas comme un défaut.
    // C'est la pire façon d'échouer, parce qu'elle n'apprend rien.
    expect(() => intervalleMinimalDuCron("*/0 * * * *"), "un pas nul").toThrow();
    expect(() => intervalleMinimalDuCron("0 6 * *"), "quatre champs").toThrow();
  });

  it("[LE CŒUR] le nombre de ticks par jour tient dans ce que le palier autorise", () => {
    // ⚠️ L'ancienne garde n'exigeait que cinq champs séparés par des espaces : `*/5 * * * *` la
    // satisfaisait intégralement. Sur `hobby`, une telle expression ne dégrade pas silencieusement —
    // elle FAIT ÉCHOUER LE DÉPLOIEMENT (« cron expressions that would run more frequently will fail
    // during deployment »). La CI doit le dire avant Vercel.
    //
    // Mutation-cible : passer le schedule à `*/5 * * * *`. Ce test doit rougir.
    const intervalle = intervalleMinimalDuCron(scheduleDeLOrdonnanceur());
    const ticksParJour = 86_400 / intervalle;
    expect(
      ticksParJour,
      `${ticksParJour} tick(s) par jour, et le palier « ${PALIER} » en autorise ${TICKS_MAX_PAR_JOUR[PALIER]}`,
    ).toBeLessThanOrEqual(TICKS_MAX_PAR_JOUR[PALIER]);
  });

  it("[LE CŒUR] deux ticks ne peuvent pas se CHEVAUCHER", () => {
    // Ce que cette assertion tue, et qui n'est pas évident : `executer.ts` n'a AUCUN verrou au niveau
    // du registre — seulement un par job, par la réclamation. Deux invocations qui se recouvrent
    // peuvent donc exécuter le job N+1 de l'une pendant le job N de l'autre. L'arbitrage du plafond
    // par famille — « la synthèse passe avant le rappel, TOUJOURS » — deviendrait alors un tirage au
    // sort entre deux processus, et le courriel perdant serait perdu pour de bon.
    //
    // Tant que l'intervalle dépasse le budget d'un tick complet, ce recouvrement est impossible par
    // construction, et il n'y a pas de verrou à écrire.
    const intervalleMs = intervalleMinimalDuCron(scheduleDeLOrdonnanceur()) * 1_000;
    const budgetComplet = BUDGET_TICK_MS + margeHorsDelais(REGISTRE.length);
    expect(
      intervalleMs,
      `${intervalleMs} ms entre deux ticks, pour un tick qui peut durer ${budgetComplet} ms`,
    ).toBeGreaterThanOrEqual(budgetComplet);
  });

  it("[DST] chaque date civile Paris reçoit au moins un tick, y compris aux deux bascules", () => {
    // ⚠️ Le schedule s'interprète en UTC pendant que `fenetreDe` tranche en Europe/Paris. Une fenêtre
    // civile qui ne recevrait aucun tick serait un jour entier sans exécution — et pour le rappel
    // d'échéance, qui n'est JAMAIS rattrapé, ce serait des courriels perdus définitivement.
    //
    // Les deux bascules 2026 : 29 mars (la journée dure 23 h) et 25 octobre (elle dure 25 h). Un
    // schedule proche de minuit UTC serait exactement le piège ; celui-ci ne l'est pas, et c'est
    // cette propriété-là qu'on fige.
    const schedule = scheduleDeLOrdonnanceur();
    for (const [debut, fin, bascule] of [
      ["2026-03-26T00:00:00Z", "2026-04-02T00:00:00Z", "2026-03-29"],
      ["2026-10-22T00:00:00Z", "2026-10-29T00:00:00Z", "2026-10-25"],
    ] as const) {
      const servies = new Set(
        ticksUtc(schedule, new Date(debut), new Date(fin)).map((d) => dateCivileParis.format(d)),
      );
      // Les dates civiles attendues, relevées à midi UTC — un instant qu'aucune bascule ne déplace
      // d'un jour, contrairement à minuit.
      //
      // ⚠️ ON ÉCARTE LE PREMIER ET LE DERNIER JOUR CIVIL (corrigé en revue). La fenêtre est bornée en
      // UTC alors que la propriété se définit en jours civils PARIS : une journée Paris commence à
      // 22 h ou 23 h UTC la veille, donc les journées de bord sont partiellement HORS de la fenêtre
      // balayée. Les exiger servies inventait des jours non servis pour un schedule proche de minuit
      // UTC — un test rouge sur du code sain, ce qui finit toujours par faire relâcher la garde.
      const civilesTriees = [...new Set<string>(
        Array.from(
          { length: Math.floor((new Date(fin).getTime() - new Date(debut).getTime()) / 86_400_000) },
          (_, i) => dateCivileParis.format(new Date(new Date(debut).getTime() + 43_200_000 + i * 86_400_000)),
        ),
      )].sort();
      const attendues = civilesTriees.slice(1, -1);

      // Anti-vacuité : c'était le SEUL test du fichier à en manquer. Si `attendues` était vide, la
      // boucle ci-dessous ne s'exécuterait pas et le test serait vert sans avoir rien vérifié — sur
      // le sujet même où l'on veut une preuve.
      expect(attendues.length, `${debut} → ${fin} doit couvrir plusieurs journées civiles`).toBeGreaterThanOrEqual(4);
      expect(attendues, "la bascule doit être DANS la fenêtre examinée").toContain(bascule);

      for (const jour of attendues) {
        expect(servies.has(jour), `aucun tick pour la journée Paris du ${jour}`).toBe(true);
      }
    }
  });
});

describe("[6.1/AC1] la chaîne à trois termes", () => {
  it("[LE CŒUR] Σ delaiMs + marge ≤ BUDGET_TICK_MS ≤ PLAFOND_DUREE_MS[PALIER]", () => {
    // Ce que cette chaîne ajoute à l'ancienne garde `[T3-3]` : un TROISIÈME terme que le dépôt ne
    // choisit pas. `maxDuration` et `BUDGET_TICK_MS` sont deux nombres que nous écrivons ; le plafond
    // du palier est un fait de la plateforme. Sans lui, la garde compare le registre à un nombre que
    // le développeur vient d'écrire dans le fichier d'à côté — et la seule chose qu'elle ne peut pas
    // vérifier, c'est ce nombre-là.
    const somme = REGISTRE.reduce((total, job) => total + job.delaiMs, 0);
    const marge = margeHorsDelais(REGISTRE.length);

    expect(
      somme + marge,
      `Σ delaiMs = ${somme} ms + marge(${REGISTRE.length}) = ${marge} ms doit tenir dans BUDGET_TICK_MS = ${BUDGET_TICK_MS} ms`,
    ).toBeLessThanOrEqual(BUDGET_TICK_MS);

    expect(
      BUDGET_TICK_MS,
      `le budget qu'on s'accorde (${BUDGET_TICK_MS} ms) doit tenir dans ce que le palier « ${PALIER} » autorise (${PLAFOND_DUREE_MS[PALIER]} ms)`,
    ).toBeLessThanOrEqual(PLAFOND_DUREE_MS[PALIER]);
  });

  it("[LE DUAL] le mou est borné PAR LE HAUT — on ne peut pas acheter du plafond sans job", () => {
    // ⚠️ La garde la plus contre-intuitive du fichier, et celle sans laquelle tout le reste est
    // décoratif. `Σ + marge ≤ BUDGET_TICK_MS` est satisfaite *de mieux en mieux* à mesure qu'on
    // desserre le budget : le mutant « je monte BUDGET_TICK_MS à 300 000 et je ne touche à rien »
    // est vert par construction. Cette assertion-ci dit que le budget doit rester SERRÉ autour du
    // registre — donc que monter le plafond exige d'avoir un job à y mettre.
    //
    // Mutation-cible : `BUDGET_TICK_MS = 300_000` (le plafond `hobby`, donc toujours dans la chaîne
    // de gauche à droite). Ce test doit rougir. C'est lui qui rend la story utile.
    const somme = REGISTRE.reduce((total, job) => total + job.delaiMs, 0);
    const mou = BUDGET_TICK_MS - (somme + margeHorsDelais(REGISTRE.length));
    expect(
      mou,
      `le budget dépasse le registre de ${mou} ms — au-delà de ${RESERVE_DECLAREE_MS} ms, c'est du plafond acheté sans job pour le justifier`,
    ).toBeLessThanOrEqual(RESERVE_DECLAREE_MS);
    expect(mou, "et il ne peut pas être négatif : ce serait l'inégalité de gauche, déjà rouge").toBeGreaterThanOrEqual(
      0,
    );
  });

  it("[FAISABILITÉ] le registre de la fin de l'Epic 6 rentre dans le palier — on le sait AVANT la 6.2", () => {
    // La seule assertion de ce fichier qui regarde DEVANT. À six jobs — fin de l'Epic 6 — la marge
    // passe à `margeHorsDelais(6)`, et même en provisionnant large pour les trois jobs à venir on
    // reste très en dessous du plafond du palier. Sans cette preuve, la 6.1 serait un travail de
    // mesure dont on ignorerait s'il conclut « ça passe » ou « il faut tout revoir ».
    //
    // ⚠️ Elle ne dit PAS que le budget d'aujourd'hui suffit : `BUDGET_TICK_MS` devra monter, job par
    // job, dans le commit de chaque story qui en ajoute un.
    const somme = REGISTRE.reduce((total, job) => total + job.delaiMs, 0);
    const PROVISION_PAR_JOB_NEUF_MS = 10_000;
    const jobsALaFinDeLEpic = 6;
    const besoin =
      somme + (jobsALaFinDeLEpic - REGISTRE.length) * PROVISION_PAR_JOB_NEUF_MS + margeHorsDelais(jobsALaFinDeLEpic);
    expect(
      besoin,
      `à ${jobsALaFinDeLEpic} jobs il faudrait ${besoin} ms, et le palier « ${PALIER} » en accorde ${PLAFOND_DUREE_MS[PALIER]}`,
    ).toBeLessThanOrEqual(PLAFOND_DUREE_MS[PALIER]);
  });

  it("`PALIER` est un littéral versionné dans le dépôt, jamais une variable d'environnement", () => {
    // Mutation-cible : `const PALIER = process.env.VERCEL_PLAN ?? "hobby"`. La CI n'a pas cette
    // variable, donc la garde vérifierait le plafond `hobby` pendant que la production tourne sur un
    // autre — et l'inverse le jour où quelqu'un la pose en CI « pour que ça passe ». Un palier est une
    // décision commerciale : elle se lit dans un diff, pas dans un tableau de bord.
    const source = readFileSync(BUDGET, "utf-8");
    expect(source, "le palier doit être écrit en toutes lettres dans le module de budget").toMatch(
      /export const PALIER: Palier = "(hobby|pro)";/,
    );
    expect(sansCommentaires(source), "aucun `process.env` dans un module de domaine (AD-1)").not.toMatch(/process\.env/);
  });

  it("le budget ne se déclare QU'À UN endroit — `vercel.json` ne règle pas la durée de la porte", () => {
    // Mutation-cible : ajouter `"functions": { "app/api/ordonnanceur/route.ts": { "maxDuration": 300 } }`.
    // Deux endroits peuvent déclarer la durée d'une fonction ; la CI n'en lit qu'un. Celui qui gagne
    // en production ne serait pas celui que les gardes mesurent — et toute la chaîne ci-dessus
    // deviendrait une fiction vérifiée avec soin.
    const vercel = JSON.parse(readFileSync(resolve(RACINE, "vercel.json"), "utf-8")) as {
      functions?: Record<string, unknown>;
    };
    const visant = Object.keys(vercel.functions ?? {}).filter((glob) => /api\/ordonnanceur/.test(glob));
    expect(visant, "la durée de la porte se décide dans la route, et nulle part ailleurs").toEqual([]);
  });
});

describe("[6.1/AC4] la marge est une FONCTION, et elle est testée comme telle", () => {
  it("elle croît d'exactement `COUT_PAR_JOB_MS` par job — pour au moins deux valeurs de n", () => {
    // ⚠️ **Toute formule calibrée à rebours passe l'inégalité de la chaîne.** `margeHorsDelais = 0`
    // la passe. `1_000 × n` la passe aussi — tout en DESSERRANT la garde de 5 s à trois jobs, avec
    // l'air de la renforcer puisque le nombre grandit avec n. La chaîne ne peut pas les distinguer :
    // elle se satisfait d'une marge PETITE. C'est pourquoi la marge doit être éprouvée
    // indépendamment, comme fonction.
    expect(margeHorsDelais(0), "même sans aucun job, le répartiteur vérifie l'environnement").toBeGreaterThan(0);
    expect(margeHorsDelais(3), "pas de régression sous la valeur plate déjà jugée juste").toBeGreaterThanOrEqual(8_000);
    for (const n of [0, 3, 5]) {
      expect(margeHorsDelais(n + 1) - margeHorsDelais(n), `le pas entre ${n} et ${n + 1} jobs`).toBe(COUT_PAR_JOB_MS);
    }
  });

  it("[MÉTA] elle est calibrée sur un COMPTAGE du répartiteur, pas sur un chiffre d'auteur", () => {
    // Le cœur de la tâche : confronter la formule au code réel plutôt qu'à une intuition. Si
    // quelqu'un ajoute un appel de dépôt dans la boucle par job, ce test rougit et exige que la
    // marge suive — c'est le couplage que la constante plate n'avait pas.
    const executeur = sansCommentaires(readFileSync(resolve(RACINE, "lib/ordonnanceur/executer.ts"), "utf-8"));

    // Le coût FIXE : un seul appel hors boucle. ⚠️ Il ne s'appelle pas `deps.depot.` — il est
    // indirect, et son corps vit dans `lib/ordonnanceur/environnement.ts`. Le chercher sous le motif
    // ci-dessous ne le trouverait pas.
    expect(executeur, "le coût fixe couvre la vérification d'environnement").toMatch(
      /await verifierEnvironnement\(deps\.depot\)/,
    );
    expect(margeHorsDelais(0), "…donc au moins un aller-retour, même à registre vide").toBeGreaterThanOrEqual(
      COUT_ALLER_RETOUR_MS,
    );

    // Le coût PAR JOB, compté mécaniquement. Quatre occurrences aujourd'hui : `reclamer`,
    // `clore(false)`, `leverIncident`, `clore(true)`. Les deux `clore` servent des chemins
    // MUTUELLEMENT EXCLUSIFS — un job donné en fait un seul —, d'où le retrait d'une unité pour
    // obtenir le pire cas réellement atteignable par un job : reclamer + clore + leverIncident.
    const appelsDepot = (executeur.match(/await deps\.depot\./g) ?? []).length;
    expect(appelsDepot, "anti-vacuité : si ce motif ne trouve plus rien, la calibration ne mesure plus rien").toBe(4);
    const pireCasParJob = appelsDepot - 1;

    expect(
      margeHorsDelais(1) - margeHorsDelais(0),
      `le répartiteur peut faire ${pireCasParJob} allers-retours pour un seul job ; la marge doit les provisionner`,
    ).toBeGreaterThanOrEqual(pireCasParJob * COUT_ALLER_RETOUR_MS);
  });
});

describe("[6.1/AC3] la couture du littéral `maxDuration`", () => {
  it("la route déclare `maxDuration` UNE fois, en littéral, et à la valeur décidée", () => {
    // ⚠️ Ce test en remplace deux (corrigé en revue). J'avais écrit (a) « c'est un littéral » et (b)
    // « ce littéral vaut ceil(BUDGET_TICK_MS/1000) » en affirmant qu'aucune ne remplaçait l'autre.
    // C'était faux : les deux portaient la MÊME expression régulière, et (b) commençait par
    // `expect(trouve).not.toBeNull()` — (a) était donc strictement incluse dans (b), et aucune
    // mutation ne pouvait tuer l'une sans tuer l'autre. Deux défenses qui se couvrent ne valent pas
    // mieux qu'une, et coûtent la confiance qu'on met dans les deux.
    //
    // Ce qui reste, ce sont TROIS propriétés distinctes, chacune tuée par une mutation différente :
    const route = readFileSync(resolve(RACINE, "app/api/ordonnanceur/route.ts"), "utf-8");
    const declarations = [...route.matchAll(/export const maxDuration\s*=\s*([^;]+);/g)].map((m) => m[1].trim());

    // 1. Une seule déclaration. Deux `export const maxDuration` — l'une commentée en apparence, ou
    //    ajoutée sous un `if` — laisseraient la CI mesurer la première et la plateforme prendre la
    //    dernière. Mutation-cible : en ajouter une seconde.
    expect(declarations, "`maxDuration` se déclare exactement une fois").toHaveLength(1);

    // 2. Un littéral. Next exige une valeur statiquement analysable :
    //    `export const maxDuration = SECONDES_DU_BUDGET;` a l'air d'être exactement la bonne façon de
    //    ne jamais désaccorder les deux nombres, et c'est le contraire — la valeur est IGNORÉE EN
    //    SILENCE et la plateforme retombe sur son défaut. Mutation-cible : l'écrire en expression.
    expect(declarations[0], "un nombre écrit en clair, jamais une constante importée").toMatch(/^\d+$/);

    // 3. Et c'est la valeur décidée. Mutation-cible : monter `BUDGET_TICK_MS` sans toucher la route,
    //    ou l'inverse — la faute qu'on ne voit pas en relecture, parce qu'elle vit dans deux fichiers
    //    qu'on n'ouvre jamais ensemble.
    expect(Number(declarations[0]), "la plateforme reçoit le budget qu'on a décidé, à la seconde près").toBe(
      Math.ceil(BUDGET_TICK_MS / 1000),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// REVUE 4.9 / T3-3 — le budget du registre doit tenir dans celui de la plateforme
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[T3-3] chaque job garde de quoi faire son travail", () => {
  /*
   * ⚠️ Le test « [LE CŒUR] Σ delaiMs + marge ≤ maxDuration » qui vivait ici a été REMPLACÉ par la
   * Story 6.1, il n'a pas été supprimé. Ce qu'il faisait est repris, en mieux, par trois assertions
   * plus haut dans ce fichier :
   *
   *   • `[6.1/AC1] [LE CŒUR]` — la même inégalité, mais contre `BUDGET_TICK_MS` puis contre le
   *     plafond du palier. Il comparait le registre à `maxDuration`, c'est-à-dire à un nombre écrit
   *     par le développeur qui venait d'ajouter un job : la seule chose qu'il ne pouvait pas
   *     vérifier était ce nombre-là.
   *   • `[6.1/AC1] [LE DUAL]` — la borne HAUTE, qu'il n'avait pas, et sans laquelle « je monte le
   *     plafond » est vert.
   *   • `[6.1/AC3]` (a) et (b) — la couture avec le littéral de la route, qu'il faisait à demi.
   *
   * Sa `MARGE_MS = 8_000` en dur est devenue `margeHorsDelais(n)`, calibrée sur un comptage du
   * répartiteur : elle était juste à trois jobs et devenait un mensonge à six, en restant verte.
   */

  it("[6.1/AC5] CHAQUE job garde de quoi faire au moins une unité de travail — et aucun n'y échappe", () => {
    // Le pendant de la chaîne du budget : rétrécir les `delaiMs` pour satisfaire l'addition n'est une
    // solution que tant que chaque job peut encore faire quelque chose. Un job sous son plancher rend
    // la main à chaque tick sans jamais servir personne — un système qui ne fait rien, et qui le fait
    // sans se plaindre.
    //
    // ⚠️ Story 6.1 — cette garde était NOMINATIVE : elle cherchait `synthese-hebdomadaire` et lui
    // seul. Elle ne se serait donc jamais étendue toute seule, et les trois jobs de l'Epic 6 seraient
    // entrés au registre sans plancher, sous une garde verte qui donnait l'impression du contraire.
    // Une garde qui nomme sa cible protège sa cible, pas la propriété.
    //
    // Mutation-cible : ajouter un job avec `delaiMs: 100, reserveMs: 5_000`. Ce test doit rougir.
    // ⚠️ LE COMPTEUR EST INCRÉMENTÉ, PAS FILTRÉ (corrigé en revue). La version initiale écrivait
    // `REGISTRE.filter((job) => { expect(...); return true; })` puis comparait la longueur du
    // résultat à celle du registre : le prédicat rendant INCONDITIONNELLEMENT `true`, l'égalité était
    // vraie par construction. C'était une anti-vacuité qui ne pouvait pas rougir, posée à côté d'une
    // qui le pouvait — donc rassurante sur une propriété que personne ne vérifiait.
    let vus = 0;
    for (const job of REGISTRE) {
      vus++;
      expect(
        job.delaiMs,
        `${job.nom} : ${job.delaiMs} ms de budget pour un plancher de ${job.reserveMs} ms — il ne peut rien faire`,
      ).toBeGreaterThanOrEqual(job.reserveMs);
      expect(job.reserveMs, `${job.nom} : un plancher doit être un vrai nombre positif`).toBeGreaterThan(0);
    }

    // Anti-vacuité : sans elle, un `REGISTRE` vide rendrait ce test vert en n'assérant rien du tout.
    // C'est la faute qu'on ne voit jamais, parce qu'elle ressemble au succès.
    expect(vus, "tous les jobs du registre doivent être passés sous la garde").toBe(REGISTRE.length);
    expect(REGISTRE.length, "et il doit y avoir des jobs à garder").toBeGreaterThan(0);
  });

  it("[6.1] le plancher de CHAQUE job est la constante que son code emploie vraiment", () => {
    // ⚠️ `reserveMs` n'est lu par AUCUN code de production (trouvé en revue) : chaque job importe sa
    // propre constante de réserve et compare lui-même. La garde `delaiMs >= reserveMs` compare donc
    // deux DÉCLARATIONS du même fichier — un job pourrait déclarer `reserveMs: 1` et rester vert
    // tout en rendant la main à chaque tick, puisque son code, lui, utiliserait la vraie valeur.
    //
    // On ancre donc chaque plancher à la constante réellement employée. C'est ce qui fait de
    // `reserveMs` une mesure et non une décoration.
    const ancres: Record<string, number> = {
      "sante-ordonnanceur": RESERVE_INCIDENT_MS,
      "synthese-hebdomadaire": RESERVE_PERSONNE_MS,
      [NOM_RAPPEL]: RESERVE_ENVOI_MS,
      // ⚠️ `RESERVE_PERSONNE_POUSSEE_MS`, et surtout pas `RESERVE_PERSONNE_MS` : le dépôt a DÉJÀ payé
      // une fois la collision de noms entre le plancher de la synthèse (31 000 ms) et celui du rappel
      // (5 500 ms). Le socle a été nommé pour ne pas la reproduire une troisième fois.
      [NOM_SOCLE]: RESERVE_PERSONNE_POUSSEE_MS,
    };
    for (const job of REGISTRE) {
      expect(ancres[job.nom], `${job.nom} : aucun plancher de référence déclaré dans ce test`).toBeDefined();
      expect(job.reserveMs, `${job.nom} : son plancher doit être la constante que son code emploie`).toBe(
        ancres[job.nom],
      );
    }
    // Anti-vacuité : si un job entre au registre sans être ajouté ici, la boucle passerait sur un
    // `undefined` — d'où le `toBeDefined` ci-dessus, et ce compte qui refuse un registre rétréci.
    expect(Object.keys(ancres).length, "un plancher de référence par job du registre").toBe(REGISTRE.length);
  });

  it("le plancher de la synthèse est bien celui du fan-out par PERSONNE", () => {
    // La garde ci-dessus vérifie la relation `delaiMs >= reserveMs` pour tous ; celle-ci vérifie que
    // le plancher déclaré par la synthèse est le BON — l'appel au modèle fort plus ses allers-retours,
    // et non un nombre choisi pour que l'inégalité passe.
    //
    // ⚠️ C'est ici que se voit la collision de noms réparée par la 6.1 : jusque-là, DEUX constantes
    // s'appelaient `RESERVE_PERSONNE_MS` — celle-ci (31 000 ms) et celle du job de rappel (5 500 ms,
    // devenue `RESERVE_ENVOI_MS`). L'auto-complétion importait la mauvaise sans le moindre signal.
    const synthese = REGISTRE.find((j) => j.nom === "synthese-hebdomadaire");
    expect(synthese, "le job de synthèse est au registre").toBeDefined();
    expect(synthese!.reserveMs, "de quoi tenter une personne : l'appel modèle plus ses allers-retours").toBe(
      RESERVE_PERSONNE_MS,
    );
  });
});
