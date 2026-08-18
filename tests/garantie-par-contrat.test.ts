import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * garantie-par-contrat.test.ts — LA GARANTIE PORTE SUR UN CONTRAT, PAS SUR UNE VIE
 * (revue adversariale du 2026-08-18, R3 · FR-089 · FR-071 · migration 0075).
 *
 * ══ CE QUE LE PRODUIT AFFIRMAIT À QUELQU'UN QUI AVAIT REPAYÉ ══════════════════════════════════
 *
 *   janvier 2026 — elle s'abonne (69 €), ne pose aucune branche ;
 *   mai 2026     — elle exerce la garantie, les 69 € reviennent, `confirme_le` est posée ;
 *   janvier 2027 — la souscription meurt ;
 *   février 2027 — elle se RÉABONNE. 69 € débités une seconde fois ;
 *   juin 2027    — `eligible_au_remboursement()` rend `true`, la page affiche le bouton.
 *
 * Au clic, `demander_remboursement` retrouvait la ligne de 2026 — clé primaire sur
 * `utilisatrice_id`, une seule ligne par compte, jamais purgée — donc `deja_demande = true` et
 * `confirme_le` non nul. La route court-circuitait Stripe :
 *
 *     if (reservation.dejaDemande && reservation.confirmeLe) return vers("rembourse");
 *
 * L'écran disait « C'est demandé. Le remboursement arrive sur ton moyen de paiement. », puis, en
 * permanence, « Ton remboursement est parti » — celui d'il y a un an. Aucun journal, aucune trace :
 * elle attendait 69 € qui ne partiraient jamais, pendant que le produit affirmait qu'ils étaient
 * partis. Ce n'est pas un refus mal formulé — un refus laisse une prise. C'est une fausse
 * confirmation, et elle ferme la question.
 *
 * ══ CE QUE CE FICHIER DOIT PROUVER, ET DANS LES DEUX SENS ═════════════════════════════════════
 *
 * Frappe un Supabase LOCAL réel : la clé primaire, l'unicité `nulls not distinct` et le ciblage
 * des RPC ne se lisent nulle part ailleurs. Et la moitié de ces tests sont des CONTRÔLES : élargir
 * la garantie sans casser l'idempotence est tout l'enjeu — une propriété que 0038 avait construite
 * exprès, et qu'il aurait été facile de perdre en la regrainant.
 */

const url = process.env.SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const ILY_A = (mois: number) => new Date(Date.now() - mois * 30 * 24 * 3600 * 1000).toISOString();

async function creer(suffixe: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: `r3-${suffixe}-${t}@exemple.test`,
    password: "test-garantie-123!",
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  return data.user!.id;
}

/** Pose (ou remplace) le contrat courant — la projection est UNE ligne par utilisatrice. */
async function contrat(id: string, sub: string | null, debutLe: string | null, etat = "actif") {
  const { error } = await admin.from("abonnement").upsert(
    {
      utilisatrice_id: id,
      etat,
      debut_le: debutLe,
      stripe_subscription_id: sub,
      source_maj_le: new Date().toISOString(),
    },
    { onConflict: "utilisatrice_id" },
  );
  if (error) throw new Error(`contrat: ${error.message}`);
}

type Reservation = { cle: string; subscription_id: string | null; deja_demande: boolean; confirme_le: string | null };

async function demander(id: string, motif = "garantie"): Promise<Reservation> {
  const { data, error } = await admin.rpc("demander_remboursement", { p_utilisatrice: id, p_motif: motif });
  if (error) throw new Error(`demander(${motif}): ${error.message}`);
  return (data as Reservation[])[0];
}

async function confirmer(id: string, evt: string, cle: string | null) {
  const { error } = await admin.rpc("confirmer_remboursement", {
    p_utilisatrice: id,
    p_provider_event_id: evt,
    p_type: "refund.created",
    p_cle: cle,
  });
  if (error) throw new Error(`confirmer: ${error.message}`);
}

const eligible = async (id: string) =>
  (await admin.rpc("eligible_au_remboursement", { p_utilisatrice: id })).data as boolean;

const lignes = async (id: string) =>
  (
    await admin
      .from("remboursement")
      .select("stripe_subscription_id, cle_idempotence, confirme_le, echec_le, motif")
      .eq("utilisatrice_id", id)
      .order("demande_le")
  ).data ?? [];

let elle = "";
let mineure = "";

beforeAll(async () => {
  elle = await creer("elle");
  mineure = await creer("mineure");
});
afterAll(async () => {
  for (const id of [elle, mineure]) {
    if (!id) continue;
    await admin.from("remboursement").delete().eq("utilisatrice_id", id);
    await admin.from("abonnement").delete().eq("utilisatrice_id", id);
    await admin.auth.admin.deleteUser(id);
  }
});

describe("[R3] un second contrat rouvre la garantie — parce qu'elle a repayé", () => {
  it("[LE CŒUR] après un réabonnement, la demande est NEUVE et porte une AUTRE clé", async () => {
    // Le premier contrat, exercé et remboursé.
    await contrat(elle, `sub_${t}_A`, ILY_A(4));
    const premiere = await demander(elle);
    expect(premiere.deja_demande, "la toute première demande ne peut pas être un doublon").toBe(false);
    await confirmer(elle, `evt-${t}-A`, premiere.cle);

    // Le contrat meurt, elle se réabonne : nouvelle souscription, nouveau `debut_le`.
    await contrat(elle, `sub_${t}_B`, ILY_A(4));

    const seconde = await demander(elle);
    expect(
      seconde.deja_demande,
      "la ligne d'un contrat CLOS fait passer une demande neuve pour un doublon",
    ).toBe(false);
    expect(seconde.cle, "la même clé d'idempotence : Stripe ne rembourserait rien").not.toBe(premiere.cle);
    expect(
      seconde.confirme_le,
      "l'écran annoncerait « le remboursement est parti » à propos de celui d'il y a un an",
    ).toBeNull();
    expect(seconde.subscription_id).toBe(`sub_${t}_B`);
  });

  it("les DEUX lignes coexistent — l'historique du premier remboursement n'est pas effacé", async () => {
    // L'export RGPD (0057) les porte toutes les deux, et c'est ce qu'on lui demande.
    const l = await lignes(elle);
    expect(l).toHaveLength(2);
    expect(l.map((x) => x.stripe_subscription_id)).toEqual([`sub_${t}_A`, `sub_${t}_B`]);
  });

  it("[L'IDEMPOTENCE, CONSERVÉE] redemander SUR LE MÊME contrat rend LA MÊME clé", async () => {
    // La propriété que 0038 avait construite exprès, simplement portée au bon grain. La perdre
    // rembourserait autant de fois qu'il y a de tentatives — et le bogue ne se verrait qu'en
    // relevé bancaire.
    const a = await demander(elle);
    const b = await demander(elle);
    expect(b.deja_demande).toBe(true);
    expect(b.cle).toBe(a.cle);
    expect(await lignes(elle), "un rejeu a créé une seconde ligne sur le même contrat").toHaveLength(2);
  });

  it("[LE CIBLAGE] confirmer par la clé n'écrit QUE sur la ligne visée", async () => {
    // ⚠️ TANT QU'IL N'Y AVAIT QU'UNE LIGNE, `where utilisatrice_id = …` DÉSIGNAIT LA BONNE. Avec
    // deux contrats, cette clause écrirait `confirme_le` sur les deux — dont un qui n'a rien reçu.
    const seconde = await demander(elle);
    await confirmer(elle, `evt-${t}-B`, seconde.cle);
    const l = await lignes(elle);
    expect(l.every((x) => x.confirme_le != null), "une confirmation a manqué sa ligne").toBe(true);

    // Et le contrôle qui sépare : une troisième souscription NON confirmée reste non confirmée.
    await contrat(elle, `sub_${t}_C`, ILY_A(4));
    const troisieme = await demander(elle);
    const apres = await lignes(elle);
    expect(apres).toHaveLength(3);
    expect(
      apres.find((x) => x.stripe_subscription_id === `sub_${t}_C`)?.confirme_le,
      "une ligne neuve est née déjà confirmée",
    ).toBeNull();
    expect(troisieme.confirme_le).toBeNull();
  });
});

describe("[R3] confirmer et échouer visent LA ligne — jamais la plus récente par défaut", () => {
  /**
   * ⚠️ LE TEST QUI SÉPARE. Confirmer « la plus récente » est le REPLI, réservé au cas où l'événement
   * ne porte pas notre clé (remboursement créé à la main dans le tableau de bord Stripe). Quand la
   * clé est là, elle fait autorité — sinon un `refund.created` en retard sur un ancien contrat
   * confirmerait le remboursement d'un contrat NEUF qui, lui, n'a rien reçu.
   */
  it("[LE CŒUR] avec la clé, c'est la ligne VISÉE qui est confirmée, pas la dernière née", async () => {
    const u = await creer("ciblage");
    try {
      await contrat(u, `sub_${t}_X`, ILY_A(4));
      const ancienne = await demander(u);
      await contrat(u, `sub_${t}_Y`, ILY_A(4));
      const recente = await demander(u);
      expect(recente.cle).not.toBe(ancienne.cle);

      await confirmer(u, `evt-${t}-cible`, ancienne.cle);

      const l = await lignes(u);
      const x = l.find((r) => r.stripe_subscription_id === `sub_${t}_X`);
      const y = l.find((r) => r.stripe_subscription_id === `sub_${t}_Y`);
      expect(x?.confirme_le, "la ligne visée n'a pas été confirmée").not.toBeNull();
      expect(
        y?.confirme_le,
        "la confirmation a atterri sur la ligne la plus récente — un contrat qui n'a rien reçu",
      ).toBeNull();
    } finally {
      await admin.from("remboursement").delete().eq("utilisatrice_id", u);
      await admin.from("abonnement").delete().eq("utilisatrice_id", u);
      await admin.auth.admin.deleteUser(u);
    }
  });

  it("[LE REPLI, NOMMÉ] sans clé, on vise la plus récente — jamais TOUTES", async () => {
    // Une confirmation en bloc affirmerait qu'un ancien remboursement échoué a finalement abouti.
    const u = await creer("repli");
    try {
      await contrat(u, `sub_${t}_P`, ILY_A(4));
      await demander(u);
      await contrat(u, `sub_${t}_Q`, ILY_A(4));
      await demander(u);

      await confirmer(u, `evt-${t}-repli`, null);

      const l = await lignes(u);
      expect(l.filter((r) => r.confirme_le != null), "la confirmation a touché plus d'une ligne").toHaveLength(1);
      expect(l.find((r) => r.confirme_le != null)?.stripe_subscription_id).toBe(`sub_${t}_Q`);
    } finally {
      await admin.from("remboursement").delete().eq("utilisatrice_id", u);
      await admin.from("abonnement").delete().eq("utilisatrice_id", u);
      await admin.auth.admin.deleteUser(u);
    }
  });

  it("un ÉCHEC vise la même ligne, et n'écrase jamais une confirmation", async () => {
    const u = await creer("echec-cible");
    try {
      await contrat(u, `sub_${t}_R`, ILY_A(4));
      const payee = await demander(u);
      await confirmer(u, `evt-${t}-ok-r`, payee.cle);
      await contrat(u, `sub_${t}_S`, ILY_A(4));
      const enAttente = await demander(u);

      const { error } = await admin.rpc("echouer_remboursement", {
        p_utilisatrice: u,
        p_provider_event_id: `evt-${t}-ko-s`,
        p_type: "refund.updated",
        p_cle: enAttente.cle,
      });
      expect(error).toBeNull();

      const l = await lignes(u);
      const r = l.find((x) => x.stripe_subscription_id === `sub_${t}_R`);
      const ss = l.find((x) => x.stripe_subscription_id === `sub_${t}_S`);
      expect(ss?.echec_le, "l'échec a manqué sa ligne").not.toBeNull();
      expect(r?.echec_le, "un échec a démenti un remboursement déjà parti").toBeNull();
      expect(r?.confirme_le).not.toBeNull();
    } finally {
      await admin.from("remboursement").delete().eq("utilisatrice_id", u);
      await admin.from("abonnement").delete().eq("utilisatrice_id", u);
      await admin.auth.admin.deleteUser(u);
    }
  });
});

describe("[R3] l'ÉLIGIBILITÉ ne propose plus un geste déjà accompli", () => {
  it("[LE CŒUR] la garantie d'un contrat ne s'ouvre qu'une fois", async () => {
    // Un remboursement ne change pas `etat` : l'accès court jusqu'à l'échéance payée. Sans cette
    // clause, le bouton « Demander le remboursement » restait affiché à quelqu'un dont l'argent
    // était déjà revenu — et le clic répondait « le remboursement arrive », indéfiniment.
    const u = await creer("eligibilite");
    try {
      await contrat(u, `sub_${t}_E`, ILY_A(4));
      expect(await eligible(u), "contrôle positif : quatre mois, aucune branche").toBe(true);
      await demander(u);
      expect(await eligible(u), "la garantie est proposée deux fois sur le même contrat").toBe(false);

      // ET ELLE SE ROUVRE sur un contrat neuf — sinon le correctif serait un mur de plus.
      await contrat(u, `sub_${t}_F`, ILY_A(4));
      expect(await eligible(u), "un second contrat payé n'ouvre aucune garantie").toBe(true);
    } finally {
      await admin.from("remboursement").delete().eq("utilisatrice_id", u);
      await admin.from("abonnement").delete().eq("utilisatrice_id", u);
      await admin.auth.admin.deleteUser(u);
    }
  });
});

describe("[R3] le chemin MINORITÉ (FR-071) ne rembourse toujours pas deux fois", () => {
  it("[LE BORD QUI COÛTE] un compte SANS souscription : deux applications, une seule clé", async () => {
    // ⚠️ `nulls not distinct` EST LOAD-BEARING. FR-071 s'applique à tout compte détecté mineur,
    // abonné ou non — `stripe_subscription_id` est alors NULL. Avec la sémantique SQL par défaut,
    // deux NULL sont DISTINCTS : chaque application de la barrière créerait une ligne de plus, avec
    // sa propre clé d'idempotence, c'est-à-dire un remboursement de plus chez Stripe.
    await contrat(mineure, null, null);
    const une = await demander(mineure, "minorite");
    const deux = await demander(mineure, "minorite");
    expect(une.deja_demande).toBe(false);
    expect(deux.deja_demande, "la seconde application de la barrière a rouvert un remboursement").toBe(true);
    expect(deux.cle).toBe(une.cle);
    expect(await lignes(mineure)).toHaveLength(1);
  });

  it("une mineure ayant DÉJÀ obtenu la garantie n'est pas remboursée une seconde fois", async () => {
    // La convergence des deux chemins sur une seule ligne, telle que 0038 l'a écrite — simplement
    // portée au grain du contrat. La perdre était le risque principal de cette migration.
    const u = await creer("convergence");
    try {
      await contrat(u, `sub_${t}_M`, ILY_A(4));
      const garantie = await demander(u, "garantie");
      const minorite = await demander(u, "minorite");
      expect(minorite.deja_demande).toBe(true);
      expect(minorite.cle, "deux clés = deux remboursements chez Stripe").toBe(garantie.cle);
      const l = await lignes(u);
      expect(l).toHaveLength(1);
      expect(l[0]?.motif, "le motif d'origine ne doit pas être réécrit").toBe("garantie");
    } finally {
      await admin.from("remboursement").delete().eq("utilisatrice_id", u);
      await admin.from("abonnement").delete().eq("utilisatrice_id", u);
      await admin.auth.admin.deleteUser(u);
    }
  });

  it("la minorité rembourse même SANS éligibilité — ce n'est pas une garantie de satisfaction", async () => {
    const u = await creer("minorite-jeune");
    try {
      await contrat(u, `sub_${t}_J`, ILY_A(1)); // un mois : pas éligible à la garantie
      expect(await eligible(u)).toBe(false);
      const r = await demander(u, "minorite");
      expect(r.deja_demande).toBe(false);
      await expect(demander(u, "garantie")).resolves.toBeTruthy(); // la ligne existe : elle est rendue
    } finally {
      await admin.from("remboursement").delete().eq("utilisatrice_id", u);
      await admin.from("abonnement").delete().eq("utilisatrice_id", u);
      await admin.auth.admin.deleteUser(u);
    }
  });
});

describe("[R3] la table dit ce qu'elle garantit — et l'unicité est bien en base", () => {
  it("l'unicité (utilisatrice, contrat) refuse une seconde ligne sur le même contrat", async () => {
    // La garde vit dans l'INDEX, pas dans la RPC : `service_role` écrit directement dans cette
    // table (webhook, ordonnanceur), et une garde qui ne vit que dans une fonction ne garde rien.
    const u = await creer("unicite");
    try {
      await contrat(u, `sub_${t}_U`, ILY_A(4));
      await demander(u);
      const { error } = await admin
        .from("remboursement")
        .insert({ utilisatrice_id: u, motif: "garantie", stripe_subscription_id: `sub_${t}_U` });
      expect(error?.message, "deux remboursements sur le même contrat").toMatch(
        /remboursement_un_par_contrat/,
      );
    } finally {
      await admin.from("remboursement").delete().eq("utilisatrice_id", u);
      await admin.from("abonnement").delete().eq("utilisatrice_id", u);
      await admin.auth.admin.deleteUser(u);
    }
  });

  it("[LA RLS N'A PAS BOUGÉ] la table reste hors d'atteinte d'une session", async () => {
    // ⚠️ MESURÉ, PAS LU. Regrainer une clé primaire est exactement le genre de geste qui déplace des
    // privilèges sans qu'on le remarque : on éprouve donc l'écriture depuis une VRAIE session, et
    // c'est la RLS qui doit refuser — pas la RPC, à laquelle `authenticated` n'a de toute façon
    // aucun accès.
    const u = await creer("rls");
    try {
      const { createClient: creerClient } = await import("@supabase/supabase-js");
      const c = creerClient(url, process.env.SUPABASE_PUBLISHABLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: eLogin } = await c.auth.signInWithPassword({
        email: `r3-rls-${t}@exemple.test`,
        password: "test-garantie-123!",
      });
      expect(eLogin).toBeNull();

      const { error } = await c
        .from("remboursement")
        .insert({ utilisatrice_id: u, motif: "garantie", stripe_subscription_id: `sub_${t}_RLS` });
      expect(error, "une session a pu se déclarer un remboursement").not.toBeNull();

      // CONTRÔLE POSITIF : elle LIT bien les siens — l'écran et l'export en dépendent (FR-067).
      await contrat(u, `sub_${t}_RLS`, ILY_A(4));
      await demander(u);
      const { data, error: eLecture } = await c.from("remboursement").select("cle_idempotence");
      expect(eLecture).toBeNull();
      expect(data, "elle ne voit plus son propre remboursement").toHaveLength(1);
    } finally {
      await admin.from("remboursement").delete().eq("utilisatrice_id", u);
      await admin.from("abonnement").delete().eq("utilisatrice_id", u);
      await admin.auth.admin.deleteUser(u);
    }
  });
});
