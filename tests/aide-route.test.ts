import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { URL_AIDE } from "@/lib/scene";

/**
 * Story 1.8 + 2.5 — la halte `/aide` : STATIQUE, PUBLIQUE, SANS dépendance IA (AD-9/AD-15, FR-077).
 * Le filet de sécurité ne dépend d'aucun modèle IA, d'aucun compte, d'aucune détection. On prouve
 * par lecture de fichier que la page ne lit NI session NI auth NI fournisseur IA, consomme la SOURCE
 * UNIQUE des ressources (2.5, `lib/safety/ressources-aide`), les met en forme en FICHE non alarmante,
 * groupée par famille de danger, et porte « Vérifié le … » (gouvernance FR-044). Le CONTENU des
 * numéros (chiffre-par-chiffre, familles) est prouvé côté module dans `ressources-aide.test.ts`.
 */

const racine = process.cwd();
const chemin = resolve(racine, "app/aide/page.tsx");
const cheminCss = resolve(racine, "app/aide/aide.module.css");
const src = readFileSync(chemin, "utf-8");
// CSS sans commentaires : les assertions « jamais rouge/alerte » ne doivent pas se déclencher
// sur une phrase de doc (« ni rouge, ni --alerte ») — seules les VRAIES déclarations comptent.
const css = readFileSync(cheminCss, "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("URL_AIDE — source unique, alignée sur la route réelle", () => {
  it("vaut « /aide » et le fichier de route existe", () => {
    expect(URL_AIDE).toBe("/aide");
    expect(existsSync(chemin)).toBe(true);
  });
});

describe("/aide — publique, sans compte, sans traceur, SANS IA (AC2, AD-15)", () => {
  it("ne lit NI session NI auth (aucun client Supabase, aucun getUser/auth)", () => {
    expect(src).not.toMatch(/@\/lib\/data\/supabase/);
    expect(src).not.toMatch(/createSupabaseServerClient|createSupabaseAdminClient/);
    expect(src).not.toMatch(/getUser|auth\.getUser|supabase\.auth/);
  });

  it("n'appelle aucun traceur / analytics", () => {
    expect(src).not.toMatch(/analytics|gtag|mixpanel|posthog|plausible/i);
  });

  it("ne dépend d'AUCUN fournisseur IA (aucun import lib/ai, aucun SDK)", () => {
    expect(src, "le filet ne doit jamais dépendre du fournisseur IA (AD-15)").not.toMatch(/@\/lib\/ai/);
    expect(src).not.toMatch(/mistral|openai|anthropic/i);
  });

  it("porte l'identité de route « Anam »", () => {
    expect(src).toMatch(/title:\s*["']Anam["']/);
  });
});

describe("/aide — consomme la SOURCE UNIQUE des ressources (AC3, 2.5)", () => {
  it("importe la liste depuis lib/safety/ressources-aide (plus de liste inline)", () => {
    expect(src).toMatch(/@\/lib\/safety\/ressources-aide/);
    expect(src).toMatch(/RESSOURCES_AIDE/);
    expect(src).toMatch(/FAMILLES_ORDRE/);
    // plus AUCUN numéro codé en dur dans la page : la source unique est le module.
    expect(src, "3114 ne doit plus être inline dans la page").not.toContain('"3114"');
  });

  it("génère les liens tel: et le nom accessible (numéro visible EN TÊTE + service + chiffres) depuis la donnée", () => {
    expect(src).toMatch(/href=\{`tel:\$\{[^}]+\.tel\}`\}/);
    // WCAG 2.5.3 (Label in Name) : le nom accessible COMMENCE par le numéro visible (revue 2.6, R7),
    // puis le service, puis la lecture chiffre par chiffre.
    expect(src).toMatch(/aria-label=\{`\$\{[^}]+\.numero\}, \$\{[^}]+\.service\}, \$\{[^}]+\.aria\}`\}/);
  });

  it("groupe par FAMILLE de danger (en-têtes de groupe)", () => {
    expect(src).toMatch(/FAMILLES_ORDRE\.map/);
    expect(src).toMatch(/LIBELLE_FAMILLE/);
  });

  it("affiche « Vérifié le … » (gouvernance FR-044)", () => {
    expect(src).toMatch(/Vérifié le/);
    expect(src).toMatch(/verifieLeLibelle|VERIFIE_LE/);
  });

  it("porte l'ancre de transparence, cible de la mention « Anam est une IA »", () => {
    expect(src).toMatch(/id="transparence"/);
    expect(src).toMatch(/Anam est une IA/);
  });
});

describe("/aide — le bloc ressources en FICHE, JAMAIS alarmant (AC3)", () => {
  it("met en forme en fiche : surface-elevee ET bordure-forte", () => {
    expect(css).toMatch(/--surface-elevee/);
    expect(css).toMatch(/--bordure-forte/);
  });

  it("n'utilise AUCUNE couleur brute — que des tokens var(--…) → jamais de rouge alarmant (AD-9)", () => {
    // Le filet rassure : toute couleur vient du thème (tokens), aucune n'est rouge/alerte. On rejette
    // donc toute couleur LITTÉRALE (hex, rgb/hsl, nom de couleur) — bien plus robuste que blacklister
    // « red »/« #ff0000 » (qui laissait passer #e53e3e, crimson, rgb(255,0,0), var(--danger)…).
    expect(css, "couleur hex brute dans /aide").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css, "rgb()/hsl() brut dans /aide").not.toMatch(/\b(rgb|hsl)a?\(/i);
    expect(css, "nom de couleur brut (rouge/alerte) dans /aide").not.toMatch(
      /\b(red|crimson|firebrick|tomato|orangered|darkred|indianred)\b/i,
    );
    expect(css, "jamais le token d'alerte du thème").not.toMatch(/--alerte|--rouge/);
  });

  it("n'est jamais modal / bloquant", () => {
    expect(src).not.toMatch(/role="dialog"|aria-modal|<dialog/);
  });
});

describe("/aide — sortie rapide (FR-074, Story 2.6)", () => {
  const sortie = readFileSync(resolve(racine, "app/aide/SortieRapide.tsx"), "utf-8");

  it("la page monte le contrôle « Quitter » en tête", () => {
    expect(src).toMatch(/SortieRapide/);
  });

  it("navigue vers un site NEUTRE en REMPLAÇANT l'entrée d'historique (pratique standard violences)", () => {
    expect(sortie).toMatch(/"use client"/);
    expect(sortie).toMatch(/location\.replace/); // remplace l'historique (le retour ne revient pas)
    expect(sortie).toMatch(/https?:\/\//); // une URL neutre absolue
  });

  it("préserve l'étanchéité de /aide : aucune session, aucune IA, aucun traceur", () => {
    expect(sortie).not.toMatch(/@\/lib\/(data|ai)|supabase|getUser/);
    expect(sortie).not.toMatch(/analytics|gtag|mixpanel|posthog|plausible/i);
  });
});
