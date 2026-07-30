import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyserTrame } from "@/render/conversation/flux-ndjson-client";
import { LIGNE_QUOTA_EPUISEE } from "@/render/conversation/ligne-quota";

/**
 * Story 3.4 (T6) — l'UX d'épuisement côté client : la trame `quota` (cœur pur) + les gardes de source
 * du hook (terminale mais NI succès NI « Réessayer »), du composeur (désactivé-visible, motif à côté)
 * et de la copie (registre système, ZÉRO appât commercial, le socle reste ouvert).
 */

describe("analyserTrame — la trame `quota` (signal pur, 3.4)", () => {
  it("`{t:\"quota\"}` → trame quota", () => {
    expect(analyserTrame(JSON.stringify({ t: "quota" }))).toEqual({ t: "quota" });
  });
  it("champs superflus ignorés (signal pur, forward-compat)", () => {
    expect(analyserTrame(JSON.stringify({ t: "quota", motif: "x", premium: true }))).toEqual({ t: "quota" });
  });
  it("un type inconnu reste ignoré (ne casse pas le client)", () => {
    expect(analyserTrame(JSON.stringify({ t: "quotas" }))).toBeNull();
  });
});

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const useFlux = sansCommentaires(readFileSync(resolve(racine, "render/conversation/useFluxAnam.ts"), "utf-8"));
const composeur = sansCommentaires(readFileSync(resolve(racine, "render/conversation/Composeur.tsx"), "utf-8"));
const conversation = sansCommentaires(readFileSync(resolve(racine, "render/conversation/Conversation.tsx"), "utf-8"));
const fil = sansCommentaires(readFileSync(resolve(racine, "render/conversation/Fil.tsx"), "utf-8"));

describe("Story 3.4 (T6) — le hook traite `quota` comme terminal SANS échec (pas de « Réessayer »)", () => {
  it("`quota` est reconnu, terminal (break) et NON dispatché comme succès/échec", () => {
    expect(useFlux).toMatch(/trame\.t === "quota"/);
    expect(useFlux).toMatch(/onQuota\?\.\(\)/);
    // L'issue « quota » ne dispatche NI onFin NI onEchec (return avant les deux).
    expect(useFlux).toMatch(/issue === "avorte" \|\| issue === "quota"/);
  });
  it("`quota` n'est PAS traité comme une trame terminale d'ÉCHEC (jamais onEchec)", () => {
    // La trame quota est gérée AVANT la branche `fin|erreur` (sinon coupure prématurée + faux échec).
    const iQuota = useFlux.indexOf('trame.t === "quota"');
    const iTerminal = useFlux.indexOf('trame.t === "fin" || trame.t === "erreur"');
    expect(iQuota).toBeGreaterThan(-1);
    expect(iTerminal).toBeGreaterThan(-1);
    expect(iQuota, "quota géré avant la branche terminale fin|erreur").toBeLessThan(iTerminal);
  });
});

describe("Story 3.4 (T6) — le composeur désactivé-visible avec motif à côté (AC4)", () => {
  it("`motifDesactive` désactive le champ ET le bouton, sans jamais les RETIRER (composeur visible)", () => {
    expect(composeur).toMatch(/motifDesactive/);
    expect(composeur).toMatch(/const bloque = !!motifDesactive/);
    // le champ est désactivé quand bloqué…
    expect(composeur).toMatch(/disabled=\{bloque\}/);
    // …et le bouton aussi (en plus de occupe/valeur vide).
    expect(composeur).toMatch(/disabled=\{!valeur\.trim\(\) \|\| occupe \|\| bloque\}/);
    // le composeur est toujours RENDU (jamais un retour null quand bloqué).
    expect(composeur).not.toMatch(/if\s*\(\s*bloque\s*\)\s*return null/);
  });
  it("le motif est relié au champ (aria-describedby) ET annoncé (role=status)", () => {
    expect(composeur).toMatch(/aria-describedby=\{bloque \? "motif-composeur" : undefined\}/);
    expect(composeur).toMatch(/role="status"/);
  });
  it("un envoi est impossible quand bloqué (garde dans `envoyer`)", () => {
    expect(composeur).toMatch(/if\s*\(!t \|\| occupe \|\| bloque\)\s*return/);
  });
  it("le focus est REDIRIGÉ vers le motif quand le champ se désactive (revue F8, WCAG 2.4.3)", () => {
    // Le champ devenant `disabled`, le navigateur ferait retomber le focus sur <body>. Un effet le
    // redirige vers le motif visible (ciblable par script, tabIndex=-1), jamais un appât commercial.
    expect(composeur).toMatch(/if\s*\(bloque\)\s*motifRef\.current\?\.focus\(\)/);
    expect(composeur).toMatch(/ref=\{motifRef\}\s+tabIndex=\{-1\}/);
  });
});

describe("Story 3.4 (T6) — Conversation retire le placeholder vide et ne propose pas de « Réessayer »", () => {
  it("`onQuota` retire le tour d'Anam vide et arme quotaEpuise", () => {
    expect(conversation).toMatch(/onQuota:/);
    expect(conversation).toMatch(/setQuotaEpuise\(true\)/);
    expect(conversation).toMatch(/filter\(\(t\) => t\.id !== idAnam\)/);
    // le composeur reçoit le motif UNIQUEMENT si quota épuisé.
    expect(conversation).toMatch(/motifDesactive=\{quotaEpuise \? LIGNE_QUOTA_EPUISEE : undefined\}/);
  });

  it("ANNONCE UNIQUE (revue F7) : `onQuota` ne fait PAS `setAnnonce` (la région du Fil ET le motif ne doublent pas)", () => {
    // L'annonce a11y du quota est portée UNIQUEMENT par le `role="status"` du Composeur → une seule
    // région live pour cette phrase (sinon double annonce, régression AC3). On isole le corps d'onQuota.
    const iOnQuota = conversation.indexOf("onQuota:");
    const apres = conversation.slice(iOnQuota, iOnQuota + 400);
    expect(apres, "onQuota ne doit pas alimenter une 2ᵉ région live avec la même phrase").not.toMatch(/setAnnonce/);
  });

  it("garde `reessayer` (revue F9) : aucun rejeu si quota épuisé, et `quotaEpuise` dans les deps", () => {
    expect(conversation).toMatch(/if\s*\(quotaEpuise\)\s*return;/);
    expect(conversation).toMatch(/\[lancer,\s*quotaEpuise\]/); // le callback voit la valeur à jour
  });

  it("le Fil MASQUE le « Réessayer » résiduel quand quotaEpuise (revue F9)", () => {
    expect(conversation).toMatch(/quotaEpuise=\{quotaEpuise\}/); // passé au Fil
    expect(fil).toMatch(/quotaEpuise\?:\s*boolean/); // prop déclarée
    // le bouton n'est branché QUE hors quota épuisé.
    expect(fil).toMatch(/t\.etat === "echec" && onReessayer && !quotaEpuise/);
  });
});

describe("Story 3.4 (T6) — la copie : registre système, ZÉRO appât commercial (AC4)", () => {
  it("n'appâte JAMAIS : ni premium, ni abonnement, ni achat, ni « débloque »", () => {
    for (const interdit of [/premium/i, /abonn/i, /\bpay(e|er|ez)\b/i, /débloqu/i, /passe à/i, /offre/i, /achat|acheter/i]) {
      expect(LIGNE_QUOTA_EPUISEE, `interdit ${interdit}`).not.toMatch(interdit);
    }
  });
  it("rappelle que le socle reste ouvert (FR-058) — jamais un mur", () => {
    expect(LIGNE_QUOTA_EPUISEE).toMatch(/reste ouvert/i);
  });
  it("n'est pas signée d'Anam (registre SYSTÈME)", () => {
    expect(LIGNE_QUOTA_EPUISEE).not.toMatch(/—\s*anam|,\s*anam\b/i);
  });
});
