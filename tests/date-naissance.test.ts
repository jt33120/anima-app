import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { calculerAge, estMajeur } from "@/app/(auth)/naissance/age";
import { etapeOnboarding } from "@/app/(auth)/onboarding";

/** Story 1.4 — barrière 18 ans + date immuable. */

describe("Décision d'onboarding — barrière mineur + étapes consentement/révocation (revue 1.4, étendue 1.5/1.6)", () => {
  it("mineur signalé → 'mineur' (prime sur tout, refusé à chaque connexion)", () => {
    expect(etapeOnboarding({ date_naissance: null, mineur_detecte: true, barriere_minorite_le: null }, "aucun")).toBe("mineur");
    expect(etapeOnboarding({ date_naissance: "1990-01-01", mineur_detecte: true, barriere_minorite_le: null }, "valide")).toBe("mineur");
  });
  it("pas de date → 'naissance'", () => {
    expect(etapeOnboarding({ date_naissance: null, mineur_detecte: false, barriere_minorite_le: null }, "aucun")).toBe("naissance");
  });
  it("date posée mais pas de consentement → 'consentement'", () => {
    expect(etapeOnboarding({ date_naissance: "1990-01-01", mineur_detecte: false, barriere_minorite_le: null }, "aucun")).toBe("consentement");
  });
  it("date posée + consentement valide → 'suite' (la scène)", () => {
    expect(etapeOnboarding({ date_naissance: "1990-01-01", mineur_detecte: false, barriere_minorite_le: null }, "valide")).toBe("suite");
  });
  it("consentement révoqué → 'revoque' (prioritaire, même sans date, jamais renvoyée re-consentir)", () => {
    expect(etapeOnboarding({ date_naissance: "1990-01-01", mineur_detecte: false, barriere_minorite_le: null }, "revoque")).toBe("revoque");
    // Priorité sur l'absence de date (revue 1.6) : une révoquée ne repasse jamais par le tunnel.
    expect(etapeOnboarding({ date_naissance: null, mineur_detecte: false, barriere_minorite_le: null }, "revoque")).toBe("revoque");
  });
  it("ligne absente (cas défensif) → 'naissance' : jamais la scène sans état confirmé", () => {
    expect(etapeOnboarding(null, "aucun")).toBe("naissance");
  });
});

describe("Règle de majorité — pure, appliquée côté serveur (NFR-023)", () => {
  const now = new Date("2026-07-23T12:00:00Z");

  it("la veille du 18e anniversaire → mineur (17)", () => {
    expect(calculerAge("2008-07-24", now)).toBe(17);
    expect(estMajeur("2008-07-24", now)).toBe(false);
  });
  it("pile 18 ans le jour anniversaire → majeur", () => {
    expect(estMajeur("2008-07-23", now)).toBe(true);
  });
  it("bien plus de 18 ans → majeur", () => {
    expect(estMajeur("1990-01-01", now)).toBe(true);
  });
  it("16 ans → mineur", () => {
    expect(estMajeur("2010-06-15", now)).toBe(false);
  });
  it("date future ou invalide → non majeur", () => {
    expect(estMajeur("2030-01-01", now)).toBe(false);
    expect(estMajeur("pas-une-date", now)).toBe(false);
  });
});

describe("[revue 1-4, #10] UNE SEULE HORLOGE : Europe/Paris, comme le trigger", () => {
  /**
   * ══ LE DÉFAUT ═════════════════════════════════════════════════════════════════════════════════
   *
   * L'âge se comptait ici en UTC, pendant que `exiger_majorite` (0048) le compte en heure de Paris.
   * Deux horloges pour la même question — et l'en-tête de 0048 croyait l'avoir refermé : « Le
   * TypeScript est aligné dessus dans le même correctif ». Il ne l'a jamais été.
   *
   * ⚠️ ET LE DÉCALAGE NE FAIT PAS QUE REFUSER : IL BARRE À VIE. La Server Action n'échoue pas
   * poliment quand elle croit avoir affaire à une mineure — elle écrit `mineur_detecte = true`, et
   * ce drapeau NE SE RETIRE JAMAIS (FR-070, trigger de 0042 : « il se pose, ne se retire pas »,
   * y compris à `service_role`). Une adulte perdait le produit pour toujours, à cause d'un fuseau,
   * sur un créneau de deux heures par an.
   */

  it("⚠️ le jour de ses 18 ans, à 01 h 30 à Paris : MAJEURE (l'ancien calcul rendait 17)", () => {
    // 2026-08-17T23:30:00Z, c'est le 18 août 01 h 30 à Paris — le jour de son anniversaire. En UTC
    // on est encore la veille : `calculerAge` rendait 17, et la Server Action la barrait à vie.
    const nuitDeSonAnniversaire = new Date("2026-08-17T23:30:00Z");
    expect(calculerAge("2008-08-18", nuitDeSonAnniversaire)).toBe(18);
    expect(estMajeur("2008-08-18", nuitDeSonAnniversaire), "barrée à vie la nuit de ses 18 ans").toBe(
      true,
    );
  });

  it("et la VEILLE au même instant reste mineure — la porte ne s'ouvre pas d'un jour trop tôt", () => {
    // Le contrôle qui compte autant : une horloge avancée d'un jour laisserait entrer un mineur.
    const nuitDavant = new Date("2026-08-16T23:30:00Z"); // 17 août 01 h 30 à Paris
    expect(estMajeur("2008-08-18", nuitDavant)).toBe(false);
  });

  it("en heure d'HIVER aussi (UTC+1) — le décalage n'est pas une constante", () => {
    // 2026-01-14T23:30:00Z = 15 janvier 00 h 30 à Paris : elle a 18 ans.
    expect(estMajeur("2008-01-15", new Date("2026-01-14T23:30:00Z")), "le 15 janvier à Paris").toBe(
      true,
    );
  });

  it("⚠️ et un décalage FIGÉ à deux heures ferait entrer un mineur, l'hiver", () => {
    // ══ CE CAS EXISTE PARCE QU'UN MUTANT A SURVÉCU ═══════════════════════════════════════════════
    // La campagne a posé « `+ 2 * 3600_000` puis lecture en UTC » — juste l'été, faux l'hiver — et
    // AUCUN des cas ci-dessus ne le voyait : à 23 h 30 UTC, +2 h et +1 h tombent tous deux le
    // lendemain. Il faut l'heure où les deux divergent.
    //
    // 2026-01-14T22:30:00Z, c'est le 14 janvier 23 h 30 à Paris (UTC+1) — la VEILLE de ses 18 ans.
    // Avec un décalage figé à +2 h, on serait déjà le 15 : elle serait déclarée MAJEURE la veille.
    // C'est le sens dangereux du décalage — pas un refus à tort, une admission de mineur.
    const veilleDeSesDixHuitAns = new Date("2026-01-14T22:30:00Z");
    expect(
      estMajeur("2008-01-15", veilleDeSesDixHuitAns),
      "un mineur est admis la veille de son anniversaire",
    ).toBe(false);
  });

  it("le 29 février compte comme le calendrier, pas comme une arithmétique maison", () => {
    // Née un 29 février : elle a 18 ans le 1er mars des années non bissextiles (règle civile
    // française). Le calcul par (année, mois, jour) le donne sans cas particulier.
    expect(estMajeur("2008-02-29", new Date("2026-02-28T12:00:00Z")), "le 28 février").toBe(false);
    expect(estMajeur("2008-02-29", new Date("2026-03-01T12:00:00Z")), "le 1er mars").toBe(true);
  });

  it("un instant invalide ne rend jamais « majeure » — le doute barre", () => {
    expect(estMajeur("1990-01-01", new Date("pas-un-instant"))).toBe(false);
  });
});

describe("date_naissance en base — stockage + immuabilité (AD-6)", () => {
  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  let id = "";

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `dn-${Date.now()}@exemple.fr`,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    id = data.user!.id;
  });
  afterAll(async () => {
    if (id) await admin.auth.admin.deleteUser(id);
  });

  it("une date ≥ 18 se stocke une première fois", async () => {
    const { error } = await admin
      .from("utilisatrice")
      .update({ date_naissance: "1990-01-01" })
      .eq("id", id);
    expect(error).toBeNull();
    const { data } = await admin
      .from("utilisatrice")
      .select("date_naissance")
      .eq("id", id)
      .single();
    expect(data?.date_naissance).toBe("1990-01-01");
  });

  it("elle est immuable : une 2e écriture différente est refusée", async () => {
    const { error } = await admin
      .from("utilisatrice")
      .update({ date_naissance: "1991-02-02" })
      .eq("id", id);
    expect(error).not.toBeNull(); // le trigger lève « date_naissance est immuable »
  });
});
