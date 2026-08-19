import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyserTrame } from "@/render/conversation/flux-ndjson-client";
import { consigneLecture } from "@/lib/domain/consigne-lecture";
import { QUESTION_LECTURE } from "@/lib/domain/copie-lecture";
import { CLES_JEU } from "@/lib/tirage/jeu";

/**
 * lecture-frontiere.test.ts — LE SILENCE DE L'INTERFACE (Story 5.8, AC2 [DUR] · FR-018 / AD-11).
 *
 * ══ CE QUI EST GARDÉ ICI, ET CE QUI NE POURRAIT PAS L'ÊTRE AUTREMENT ════════════════════════════
 *
 * FR-018 : « tant que l'utilisatrice n'a pas répondu, aucune signification n'est affichée nulle part :
 * pas de nom de carte, pas de mot-clé, pas d'infobulle, pas de lien "en savoir plus", pas de panneau
 * "signification". Le catalogue existe côté serveur ; il n'a AUCUNE représentation dans l'interface. »
 *
 * Une politique de composant ne tient pas cet invariant : elle demande que personne, jamais, n'ajoute
 * un champ. Ce fichier le tient AUTREMENT — en vérifiant que la charge utile serveur→client N'A PAS DE
 * QUOI afficher une signification. Ce que le rendu n'a pas reçu, il ne peut pas l'afficher, et aucune
 * revue n'a besoin d'y penser.
 *
 * C'est la même garde qu'en 4.10, où le COMPTE ne franchissait pas la frontière pour que l'invitation
 * ne puisse pas devenir un reproche. Ici l'enjeu est plus grand : le rendu ne doit pas pouvoir déduire
 * une LECTURE.
 */

const racine = resolve(__dirname, "..");
const lire = (p: string) => readFileSync(resolve(racine, p), "utf-8");

/** Les mots par lesquels une signification arriverait. `sens` est le nom du module serveur. */
const CHAMPS_DE_SENS = /\b(sens|signification|motCle|motsCles|keywords?|interpretation|meaning)\s*[?:]/i;

describe("[AC2 DUR] la trame `carte` ne peut pas transporter une signification", () => {
  it("le variant serveur ne déclare NI `sens` NI aucun synonyme", () => {
    const src = lire("lib/ai/flux-ndjson.ts");
    // On isole le bloc du variant `carte` : le reste du fichier parle légitimement d'autre chose.
    const bloc = src.slice(src.indexOf('| { t: "carte"'), src.indexOf('| { t: "lecture"'));
    expect(bloc.length, "le variant `carte` a disparu — la garde ne garde plus rien").toBeGreaterThan(20);
    expect(bloc).not.toMatch(CHAMPS_DE_SENS);
  });

  it("le miroir client ne déclare NI `sens` NI aucun synonyme", () => {
    const src = lire("render/conversation/flux-ndjson-client.ts");
    const bloc = src.slice(src.indexOf('| { t: "carte"'), src.indexOf('| { t: "lecture"'));
    expect(bloc.length).toBeGreaterThan(20);
    expect(bloc).not.toMatch(CHAMPS_DE_SENS);
  });

  it("le tour de fil `carte` ne déclare NI `sens` NI aucun synonyme", () => {
    const src = lire("render/conversation/types.ts");
    const bloc = src.slice(src.indexOf('readonly role: "carte"'), src.indexOf('readonly role: "lecture"'));
    expect(bloc.length).toBeGreaterThan(20);
    expect(bloc).not.toMatch(CHAMPS_DE_SENS);
  });

  it("le modèle de vue de la carte (5.7) n’a pas gagné de champ de signification", () => {
    // Reprise de la garde de la 5.7 : elle protégeait un composant isolé, elle protège désormais un
    // composant MONTÉ. C'est le moment où elle sert vraiment.
    const src = lire("render/lecture/types.ts");
    const bloc = src.slice(src.indexOf("interface CarteTireeVue"));
    expect(bloc).not.toMatch(CHAMPS_DE_SENS);
  });

  it("`analyserTrame` RECONSTRUIT la trame champ par champ — un `sens` émis par erreur n’arrive pas", () => {
    // La dernière ligne de défense, et la seule qui tienne au RUNTIME : même si le serveur émettait un
    // jour un champ de signification (refactor, zèle, accident), le client ne le laisserait pas passer.
    //
    // ⚠️ `puits` est une carte RETIRÉE en 5.10, et c'est délibéré : la frontière ne valide pas la clé
    // contre le jeu courant, et elle ne doit pas — une lecture ouverte avant le changement de jeu doit
    // continuer de se streamer. Ne pas remplacer par une carte courante.
    const trame = analyserTrame(
      JSON.stringify({ t: "carte", cle: "puits", description: "un puits de pierre", sens: "la profondeur" }),
    );
    expect(trame).toEqual({ t: "carte", cle: "puits", description: "un puits de pierre" });
    expect(JSON.stringify(trame)).not.toContain("profondeur");
  });

  it("une trame `carte` sans description est ACCEPTÉE — aucun des 21 visuels n’est dessiné", () => {
    expect(analyserTrame(JSON.stringify({ t: "carte", cle: "pont" }))).toEqual({
      t: "carte",
      cle: "pont",
      description: null,
    });
  });

  it("une trame `carte` sans clé est REFUSÉE — une carte sans identité n’a pas de visuel", () => {
    expect(analyserTrame(JSON.stringify({ t: "carte", cle: "" }))).toBeNull();
  });
});

describe("[AC2 DUR] le catalogue de sens ne traverse jamais", () => {
  it("aucun fichier de `render/` n’importe `lib/lecture/`", () => {
    // `lib/lecture/sens-cartes.ts` porte `server-only` : l'import échouerait au build. Cette garde
    // le dit AVANT, et surtout elle le dit pour un futur module de `lib/lecture/` qui l'oublierait.
    for (const f of ["render/conversation/Fil.tsx", "render/lecture/CarteTiree.tsx", "render/lecture/Restitution.tsx"]) {
      expect(lire(f), `${f} atteint le catalogue de sens`).not.toMatch(/from\s+["'](@\/lib\/lecture|\.\.?\/.*lecture\/sens)/);
    }
  });

  it("la consigne de lecture ne reçoit NI la carte NI son sens (signature nue)", () => {
    // ⚠️ Le modèle ne reçoit que ce qu'ELLE dit avoir vu. Lui donner l'image lui donnerait deux
    // sources — sa projection et le dessin — et l'inviterait à arbitrer, alors que FR-018 a déjà
    // tranché : c'est sa projection qui fait foi.
    expect(consigneLecture.length, "`consigneLecture` a gagné un paramètre : lequel, et pourquoi ?").toBe(0);
    const contenu = consigneLecture().content;
    for (const cle of CLES_JEU) {
      expect(contenu, `la consigne nomme la carte « ${cle} »`).not.toContain(cle);
    }
  });

  it("la consigne interdit explicitement de nommer la carte et de prédire (FR-020)", () => {
    const contenu = consigneLecture().content.toLowerCase();
    expect(contenu).toContain("aucune prédiction");
    expect(contenu).toContain("ne nomme jamais la carte");
  });
});

describe("[AC3] la question est une CONSTANTE, jamais une génération", () => {
  it("elle est exactement « Qu’est-ce que tu vois ? »", () => {
    expect(QUESTION_LECTURE).toBe("Qu’est-ce que tu vois ?");
  });

  it("elle ne dit RIEN D’AUTRE — pas d’accompagnement, pas d’indice, pas de relance", () => {
    // FR-017 : « et rien d'autre ». Une seule phrase interrogative, et elle tient en cinq mots.
    expect(QUESTION_LECTURE.split("?").filter((p) => p.trim().length > 0)).toHaveLength(1);
    expect(QUESTION_LECTURE.length).toBeLessThan(40);
  });

  it("la route émet la question depuis la CONSTANTE, jamais un littéral recopié", () => {
    // Un littéral recopié dériverait le jour où la constante change, et personne ne le verrait :
    // les deux phrases se ressembleraient encore.
    const route = lire("app/api/anam/message/route.ts");
    expect(route).toContain("QUESTION_LECTURE");
    expect(route).not.toContain("Qu’est-ce que tu vois");
  });
});

describe("[AC5] la carte n’est jamais purgée par « Réessayer »", () => {
  it("le tour `carte` n’a PAS d'`ancreId` — la purge est impossible, pas seulement interdite", () => {
    const src = lire("render/conversation/types.ts");
    const bloc = src.slice(src.indexOf('readonly role: "carte"'), src.indexOf('readonly role: "lecture"'));
    expect(bloc, "un `ancreId` sur la carte la rendrait purgeable au « Réessayer »").not.toContain("ancreId");
  });

  it("le filtre de « Réessayer » ne connaît PAS le mot « carte »", () => {
    // ⚠️ CETTE GARDE A CHANGÉ DE CIBLE (revue Epics 1-4). Elle lisait le filtre à l'intérieur de
    // `Conversation.tsx` et exigeait qu'il cite `ressource`, `bilan` et `paywall` — ce qui a figé
    // pendant deux epics le défaut le plus grave de l'écran : le bloc de numéros d'urgence purgé
    // par le geste même qu'on propose après un échec. Le filtre vit désormais dans `rejeu.ts`, et
    // ce que le fil DEVIENT est exercé par `rejeu-ne-retire-pas-le-filet.test.ts`, sur de vrais
    // tours. Ce qui reste ici est ce qu'un test de source sait faire, et rien de plus.
    const src = lire("render/conversation/rejeu.ts").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    // ON CHERCHE LE MOT, PAS UNE COMPARAISON PRÉCISE. La première version de cette assertion
    // cherchait `t.role === "carte"` — et le mutant qui écrit `t.role !== "carte"` (la forme
    // NATURELLE pour exclure la carte d'un filtre de conservation) lui passait sous le nez. Le mot
    // « carte » n'a AUCUNE raison légitime d'apparaître dans la mécanique du rejeu.
    expect(src, "« Réessayer » touche à la carte : le rituel serait nié").not.toContain("carte");
  });
});
