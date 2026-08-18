import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * joignable-une-seule-definition.test.ts
 * (revue adversariale du 2026-08-18, R9 et R28 · migration 0076)
 *
 * ══ UN CORRECTIF QUI A CASSÉ CE QU'IL CONSOLIDAIT ═════════════════════════════════════════════
 *
 * La 0053 avait extrait le noyau de l'autorisation périodique, et l'avait écrit :
 *
 *     « L'ancien nom survit en DÉLÉGUANT. Il n'y a toujours qu'une seule définition […] ;
 *       deux copies auraient divergé au premier amendement d'AD-17. »
 *
 * La 0072 a ajouté `cgu_acceptees` — dans la COPIE, `eligible_au_periodique`, en ré-inlinant tout
 * le corps. La délégation a disparu, les deux copies ont divergé au premier amendement, et c'est le
 * NOYAU qui est resté en arrière. Or le noyau est le seul filtre de la sélection du socle quotidien.
 *
 * ══ CE QUE ÇA PERMETTAIT, ET QUI SE MESURE ICI ════════════════════════════════════════════════
 *
 * `consentement_proprietaire` (0004) n'a comme `with check` que `auth.uid() = utilisatrice_id`. Un
 * compte peut donc poser lui-même `{art9_accorde: true, ia_reconnue: true, cgu_acceptees: false}` —
 * ce fichier le fait, sous une VRAIE session, sans rien forger. Il recevait alors une notification
 * quotidienne sans avoir jamais accepté les CGU, dont la case porte aussi ses dix-huit ans.
 */

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-joignable-123!";

async function compte(suffixe: string): Promise<{ id: string; email: string }> {
  const email = `joignable-${suffixe}-${t}@exemple.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  return { id: data.user!.id, email };
}

async function session(email: string) {
  const c = createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: MDP });
  if (error) throw new Error(`signIn: ${error.message}`);
  return c;
}

const joignable = async (id: string) =>
  (await admin.rpc("personne_joignable", { p_utilisatrice: id })).data as boolean;
const periodique = async (id: string) =>
  (await admin.rpc("eligible_au_periodique", { p_utilisatrice: id })).data as boolean;

const comptes: string[] = [];
afterAll(async () => {
  for (const id of comptes) {
    await admin.from("consentement").delete().eq("utilisatrice_id", id);
    await admin.from("abonnement").delete().eq("utilisatrice_id", id);
    await admin.auth.admin.deleteUser(id);
  }
});

/** Un compte complet et joignable — le CONTRÔLE POSITIF de tout ce fichier. */
async function compteJoignable(suffixe: string) {
  const u = await compte(suffixe);
  comptes.push(u.id);
  await admin.from("utilisatrice").update({ date_naissance: "1990-01-01" }).eq("id", u.id);
  await admin.from("consentement").upsert(
    { utilisatrice_id: u.id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true, revoked_at: null },
    { onConflict: "utilisatrice_id" },
  );
  return u;
}

let temoin: { id: string; email: string };
beforeAll(async () => {
  temoin = await compteJoignable("temoin");
});

describe("[R9] les CGU comptent aussi pour le socle quotidien", () => {
  it("[CONTRÔLE POSITIF] un compte complet EST joignable", async () => {
    // Sans lui, une fonction qui refuserait tout satisferait le reste du fichier — et un refus
    // muet est aussi cassé qu'une porte ouverte, simplement plus discret.
    expect(await joignable(temoin.id)).toBe(true);
  });

  it("[LE CŒUR] les CGU refusées, posées PAR ELLE-MÊME sous sa vraie session", async () => {
    const u = await compte("sans-cgu");
    comptes.push(u.id);
    await admin.from("utilisatrice").update({ date_naissance: "1990-01-01" }).eq("id", u.id);

    // ⚠️ ÉCRIT SOUS JWT, PAS EN service_role. C'est tout le scénario : la policy de 0004 n'a comme
    // `with check` que `auth.uid() = utilisatrice_id`, donc rien n'empêche ce corps-là.
    const c = await session(u.email);
    const { error } = await c.from("consentement").upsert(
      { utilisatrice_id: u.id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: false },
      { onConflict: "utilisatrice_id" },
    );
    expect(error, "le scénario suppose que cette écriture PASSE — sinon il n'y a rien à garder").toBeNull();

    expect(
      await joignable(u.id),
      "le socle quotidien part à quelqu'un qui n'a jamais accepté les CGU ni confirmé ses 18 ans",
    ).toBe(false);
  });

  it("le consentement RÉVOQUÉ ferme aussi — la clause d'origine tient toujours", async () => {
    const u = await compteJoignable("revoque");
    await admin
      .from("consentement")
      .update({ revoked_at: new Date().toISOString() })
      .eq("utilisatrice_id", u.id);
    expect(await joignable(u.id)).toBe(false);
  });
});

describe("[R28] la majorité se prouve, elle ne se suppose pas", () => {
  it("[LE CŒUR] aucune date de naissance : pas joignable", async () => {
    // Miroir de `est_barre_minorite` (0066) : « toute absence barre ». Un compte qui saute
    // /naissance n'a jamais fait se prononcer le trigger de la 0048 — rien n'est établi.
    const u = await compte("sans-naissance");
    comptes.push(u.id);
    await admin.from("consentement").upsert(
      { utilisatrice_id: u.id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true, revoked_at: null },
      { onConflict: "utilisatrice_id" },
    );
    expect(await joignable(u.id)).toBe(false);
  });

  it("minorité déclarée, et minorité détectée : toujours refusées", async () => {
    // ⚠️ PAR LES VRAIS CHEMINS, ET C'EST LE HARNAIS QUI L'A APPRIS. Mon premier jet posait
    // `mineur_detecte = true` par un UPDATE direct ; la base l'a REFUSÉ :
    //   « une minorité déclarée doit porter son échéance de suppression (FR-070) —
    //     passer par declarer_minorite() ».
    // Un test qui écrit un état que le produit ne peut pas produire ne prouve rien de ce produit.
    const a = await compteJoignable("mineur-declare");
    const { error: eDecl } = await admin.rpc("declarer_minorite", {
      cible: a.id,
      echeance: "2027-01-01",
    });
    expect(eDecl, "le harnais doit vraiment poser la minorité").toBeNull();
    expect(await joignable(a.id)).toBe(false);

    const b = await compteJoignable("mineur-barre");
    const { error: eBar } = await admin.rpc("appliquer_barriere_minorite", {
      cible: b.id,
      echeance: "2027-01-01",
    });
    expect(eBar, "le harnais doit vraiment poser la barrière").toBeNull();
    expect(await joignable(b.id)).toBe(false);
  });
});

describe("[R9] la DÉLÉGATION est rétablie — c'est ça qui empêche la prochaine divergence", () => {
  it("[LE CŒUR] `eligible_au_periodique` ne fait plus que « joignable ET premium »", () => {
    // Ce qui compte n'est pas que les deux soient d'accord aujourd'hui, mais qu'il redevienne
    // IMPOSSIBLE qu'elles divergent demain. Une garde de source est ici la seule qui le dise.
    const src = readFileSync("supabase/migrations/0076_une_seule_definition_de_joignable.sql", "utf-8");
    const corps = src.slice(src.indexOf("create or replace function public.eligible_au_periodique"));
    expect(corps, "la délégation n'est pas rétablie").toMatch(
      /select public\.personne_joignable\(p_utilisatrice\)/,
    );
    expect(corps, "la copie a de nouveau ré-inliné la règle de consentement").not.toMatch(
      /art9_accorde/,
    );
    expect(corps, "la copie a de nouveau ré-inliné la clause de détresse").not.toMatch(
      /episode_detresse/,
    );
  });

  it("[MESURÉ] un non-premium joignable : le noyau dit oui, le périodique dit non", async () => {
    // Aucune LIGNE d'abonnement : le tronc gratuit (FR-088).
    expect(await joignable(temoin.id)).toBe(true);
    expect(await periodique(temoin.id), "le tronc gratuit n'ouvre pas le périodique").toBe(false);
  });

  it("[LE CAS QUI MANQUAIT] un abonnement RÉSILIÉ n'ouvre pas le périodique non plus", async () => {
    // ⚠️ TROUVÉ PAR LA CAMPAGNE DE MUTATION. Le mutant qui remplace `a.etat = 'actif'` par
    // `a.etat is not null` SURVIVAIT : mes deux cas étaient « aucune ligne » et « ligne active »,
    // et aucune ligne rend `exists` faux quelle que soit la condition. Il fallait une ligne
    // PRÉSENTE et non active — c'est-à-dire l'état de tout compte ayant résilié une fois.
    const u = await compteJoignable("resilie");
    await admin.from("abonnement").upsert(
      { utilisatrice_id: u.id, etat: "resilie", source_maj_le: new Date().toISOString() },
      { onConflict: "utilisatrice_id" },
    );
    expect(await joignable(u.id), "le noyau ne regarde pas l'abonnement").toBe(true);
    expect(await periodique(u.id), "un contrat mort a ouvert le périodique").toBe(false);
  });

  it("[LE CAS JUMEAU] et un abonnement EXPIRÉ non plus", async () => {
    const u = await compteJoignable("expire");
    await admin.from("abonnement").upsert(
      { utilisatrice_id: u.id, etat: "expire", source_maj_le: new Date().toISOString() },
      { onConflict: "utilisatrice_id" },
    );
    expect(await periodique(u.id)).toBe(false);
  });

  it("[MESURÉ] et un premium joignable ouvre les deux", async () => {
    const u = await compteJoignable("premium");
    await admin.from("abonnement").upsert(
      { utilisatrice_id: u.id, etat: "actif", source_maj_le: new Date().toISOString() },
      { onConflict: "utilisatrice_id" },
    );
    expect(await joignable(u.id)).toBe(true);
    expect(await periodique(u.id)).toBe(true);
  });

  it("[LE TEST QUI SÉPARE] un refus du NOYAU ferme aussi le périodique, chez un premium", async () => {
    // Sans ce cas, une `eligible_au_periodique` qui ignorerait le noyau (« premium suffit »)
    // passerait les deux tests ci-dessus.
    // ⚠️ LES CGU NE SE RETIRENT PAS PAR ÉCRITURE — la base l'a refusé à mon premier jet
    // (« cgu_acceptees ne se retire pas par écriture (FR-012 / NFR-006) »). On monte donc le compte
    // dans l'état voulu dès le départ, ce qui est aussi le seul état réellement atteignable.
    const u = await compte("premium-sans-cgu");
    comptes.push(u.id);
    await admin.from("utilisatrice").update({ date_naissance: "1990-01-01" }).eq("id", u.id);
    await admin.from("consentement").upsert(
      { utilisatrice_id: u.id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: false },
      { onConflict: "utilisatrice_id" },
    );
    await admin.from("abonnement").upsert(
      { utilisatrice_id: u.id, etat: "actif", source_maj_le: new Date().toISOString() },
      { onConflict: "utilisatrice_id" },
    );
    expect(await joignable(u.id)).toBe(false);
    expect(await periodique(u.id), "le premium a court-circuité le noyau").toBe(false);
  });
});
