import { describe, it, expect } from "vitest";
import { fenetreDe, estEnRetard, type DescriptionJob } from "@/lib/domain/ordonnanceur";

/**
 * Story 4.8 (T1) — LE DOMAINE PUR. Aucune base, aucun réseau : ces tests s'exécutent en microsecondes et
 * couvrent pourtant l'endroit où une erreur coûterait le plus cher — la CLÉ DE FENÊTRE. Une clé fausse, et
 * l'idempotence entière s'écroule sans qu'aucune exception ne soit levée : le job tourne simplement deux
 * fois, ou jamais.
 */

const JOB: DescriptionJob = {
  nom: "essai",
  cadence: "quotidien",
  toleranceHeures: 48,
  delaiMs: 1000,
  enServiceDepuis: new Date("2026-01-01T00:00:00Z"), // un job ANCIEN, sauf mention contraire
};

describe("[AC2] la fenêtre quotidienne suit le jour civil PARISIEN, pas UTC", () => {
  it("deux instants du même jour parisien donnent la MÊME clé", () => {
    const a = fenetreDe("quotidien", new Date("2026-08-05T04:00:00Z")); // 06:00 Paris
    const b = fenetreDe("quotidien", new Date("2026-08-05T20:00:00Z")); // 22:00 Paris
    expect(a).toBe("2026-08-05");
    expect(b).toBe("2026-08-05");
  });

  it("[LE TEST QUI COMPTE] 23h30 UTC en ÉTÉ est déjà le lendemain à Paris", () => {
    // Mutation-cible : `instant.toISOString().slice(0, 10)`. Cette implémentation naïve passe tous les
    // tests de la journée et se trompe deux heures par nuit, en été — au moment précis où les crons de
    // fin de journée s'exécutent. Le job de la veille serait alors réclamé une seconde fois.
    expect(fenetreDe("quotidien", new Date("2026-08-05T23:30:00Z"))).toBe("2026-08-06");
  });

  it("… et une heure par nuit en HIVER (CET = UTC+1)", () => {
    expect(fenetreDe("quotidien", new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
    expect(fenetreDe("quotidien", new Date("2026-01-15T22:30:00Z"))).toBe("2026-01-15");
  });

  it("la bascule d'heure d'été ne crée ni trou ni doublon de fenêtre", () => {
    // Nuit du 28 au 29 mars 2026 : 02:00 → 03:00. Le 29 mars n'a que 23 heures ; sa clé existe une fois.
    const avant = fenetreDe("quotidien", new Date("2026-03-28T23:00:00Z")); // 00:00 le 29, CET
    const apres = fenetreDe("quotidien", new Date("2026-03-29T21:59:00Z")); // 23:59 le 29, CEST
    expect(avant).toBe("2026-03-29");
    expect(apres).toBe("2026-03-29");
    expect(fenetreDe("quotidien", new Date("2026-03-29T22:01:00Z"))).toBe("2026-03-30");
  });
});

describe("[AC2] la fenêtre hebdomadaire suit la semaine ISO 8601", () => {
  it("le mercredi 5 août 2026 tombe en semaine 32", () => {
    expect(fenetreDe("hebdomadaire", new Date("2026-08-05T12:00:00Z"))).toBe("2026-W32");
  });

  it("les jours d'une même semaine partagent la clé, lundi comme dimanche", () => {
    const lundi = fenetreDe("hebdomadaire", new Date("2026-08-03T12:00:00Z"));
    const dimanche = fenetreDe("hebdomadaire", new Date("2026-08-09T12:00:00Z"));
    expect(lundi).toBe("2026-W32");
    expect(dimanche).toBe("2026-W32");
    expect(fenetreDe("hebdomadaire", new Date("2026-08-10T12:00:00Z"))).toBe("2026-W33");
  });

  it("[LE CAS PÉNIBLE] le 1er janvier 2027 appartient encore à la semaine 53 de 2026", () => {
    // Mutation-cible : utiliser l'année civile au lieu de l'année ISO. Le 1er janvier 2027 produirait
    // alors `2027-W53` — une clé neuve pour une semaine déjà traitée, donc un job hebdomadaire exécuté
    // deux fois dans la même semaine. Une fois par an, en pleine trêve, quand personne ne regarde.
    expect(fenetreDe("hebdomadaire", new Date("2026-12-31T12:00:00Z"))).toBe("2026-W53");
    expect(fenetreDe("hebdomadaire", new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53");
    expect(fenetreDe("hebdomadaire", new Date("2027-01-04T12:00:00Z"))).toBe("2027-W01");
  });

  it("la semaine est toujours écrite sur deux chiffres", () => {
    expect(fenetreDe("hebdomadaire", new Date("2026-01-08T12:00:00Z"))).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe("[AC5] le retard, et le piège du job qui n'a jamais tourné", () => {
  const maintenant = new Date("2026-08-05T12:00:00Z");

  it("une réussite dans la tolérance → pas en retard", () => {
    const recente = new Date("2026-08-04T12:00:00Z"); // 24 h, tolérance 48 h
    expect(estEnRetard(JOB, recente, new Date("2026-01-01T00:00:00Z"), maintenant)).toBe(false);
  });

  it("une réussite hors tolérance → en retard", () => {
    const vieille = new Date("2026-08-02T12:00:00Z"); // 72 h
    expect(estEnRetard(JOB, vieille, new Date("2026-01-01T00:00:00Z"), maintenant)).toBe(true);
  });

  it("[LE PIÈGE 1] au tout premier tick, RIEN n'est en retard", () => {
    // Mutation-cible : traiter `derniereReussite === null` comme « en retard ». Le jour du déploiement,
    // l'ordonnanceur s'alerterait sur chacun de ses jobs — un faux positif massif, le jour précis où on a
    // le moins besoin de bruit et le plus besoin de croire ce que dit le tableau de santé.
    expect(estEnRetard(JOB, null, maintenant, maintenant)).toBe(false);
  });

  it("[LE PIÈGE 2] un job jamais exécuté depuis longtemps EST en retard", () => {
    // Mutation-cible symétrique : traiter `null` comme « jamais en retard ». Le job mort-né — enregistré,
    // jamais déclenché — deviendrait invisible pour toujours. C'est pourtant exactement la panne qu'on veut
    // voir. C'est le repli sur la NAISSANCE DU SYSTÈME qui rend les deux pièges évitables d'un seul coup.
    const naissanceAncienne = new Date("2026-07-01T00:00:00Z");
    expect(estEnRetard(JOB, null, naissanceAncienne, maintenant)).toBe(true);
  });

  it("la dernière réussite prime sur la naissance quand elle existe", () => {
    const naissanceAncienne = new Date("2026-07-01T00:00:00Z");
    const reussiteRecente = new Date("2026-08-05T06:00:00Z");
    expect(estEnRetard(JOB, reussiteRecente, naissanceAncienne, maintenant)).toBe(false);
  });

  it("[LE PIÈGE 3] un job AJOUTÉ AUJOURD'HUI à un système ANCIEN n'est pas en retard", () => {
    // Le défaut n°4 de la revue, et il se serait déclenché dès la Story 4.9. Le job de santé passe AVANT
    // les autres dans la boucle : au tick même où un job neuf tourne pour la première fois, la santé ne
    // trouve aucune réussite à son nom. Avec le seul repli sur la naissance du SYSTÈME — vieille de
    // plusieurs semaines — elle levait un incident `job_en_retard` sur un job qui allait s'exécuter
    // quelques millisecondes plus tard. Chaque story ajoutant un job aurait ouvert par un faux incident.
    //
    // Mutation-cible : retirer `enServiceDepuis` du `Math.max` → ce test rougit.
    const nouveau: DescriptionJob = { ...JOB, enServiceDepuis: maintenant };
    const naissanceAncienne = new Date("2026-07-01T00:00:00Z");
    expect(estEnRetard(nouveau, null, naissanceAncienne, maintenant)).toBe(false);
  });

  it("[LE PIÈGE 3, l'autre bord] … mais s'il ne tourne toujours pas trois jours plus tard, il EST en retard", () => {
    // La grâce accordée au job neuf est une grâce, pas une amnistie. Mutation-cible symétrique : prendre
    // `enServiceDepuis` SEUL (sans le `max` avec la naissance) — ce test-là resterait vert, mais le PIÈGE 1
    // rougirait, puisqu'un job déclaré il y a six mois sur une base neuve serait déclaré en retard le jour
    // du déploiement. Il faut les deux tests pour clouer les deux bords.
    const nouveau: DescriptionJob = { ...JOB, enServiceDepuis: maintenant };
    const troisJoursApres = new Date(maintenant.getTime() + 72 * 3_600_000);
    expect(estEnRetard(nouveau, null, new Date("2026-07-01T00:00:00Z"), troisJoursApres)).toBe(true);
  });

  it("la tolérance est une borne STRICTE : pile à la limite n'est pas en retard", () => {
    const pile = new Date(maintenant.getTime() - 48 * 3_600_000);
    expect(estEnRetard(JOB, pile, pile, maintenant)).toBe(false);
    const uneMsDeTrop = new Date(pile.getTime() - 1);
    expect(estEnRetard(JOB, uneMsDeTrop, uneMsDeTrop, maintenant)).toBe(true);
  });
});
