import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * majorite-non-declaree.test.ts — NE PAS RÉPONDRE À LA QUESTION NE VAUT PAS MAJORITÉ.
 *
 * ══ LE DÉFAUT, TROUVÉ PAR LA REVUE DES EPICS 1 À 4 (2026-08-18) ═════════════════════════════════
 *
 * La migration 0048 ferme « déclarer une FAUSSE date » avec un trigger. Mais ce trigger est armé
 * `before insert or update OF date_naissance` : **il ne se déclenche jamais sur une colonne que
 * personne n'écrit.** Et `est_barre_minorite()` (0042) ne lit que `mineur_detecte` et
 * `barriere_minorite_le`, tous deux faux par défaut sur un compte neuf.
 *
 * Un compte créé par lien magique qui SAUTE `/naissance` a donc `date_naissance = null`,
 * `mineur_detecte = false`, `barriere_minorite_le = null` — et le prédicat qui garde QUATORZE
 * policies art. 9 rend `false`. Reproduit de bout en bout, chaque appel en 201 : consentement,
 * puis `entree_journal` (verbatim art. 9), puis `art9_temoin`.
 *
 * **Une enfant de treize ans qui n'écrit aucune date écrit sa vie intérieure dans une base art. 9,
 * et la fait lire par un modèle de langage, avec un consentement juridiquement valide au dossier.**
 *
 * ══ POURQUOI LE PRÉDICAT ET PAS LA ROUTE ════════════════════════════════════════════════════════
 *
 * `authenticated` détient les privilèges DML sur chaque table de `public` : une garde dans une
 * route, une Server Action ou du TypeScript ne garde rien — le POST direct sur PostgREST la
 * contourne. C'est ce que 0041/0042/0048 ont payé trois fois. On répare donc là où 0042 a montré
 * que ça portait : dans le prédicat partagé, qui referme les quatorze policies d'un coup.
 *
 * ══ ET POURQUOI IL FALLAIT INVERSER LA FORME ════════════════════════════════════════════════════
 *
 * `exists (… where les conditions de barrage)` échoue OUVERT sur toute absence : pas de ligne
 * `utilisatrice`, pas de barrage. Le prédicat exige désormais qu'une majorité soit POSITIVEMENT
 * ÉTABLIE — `not exists (… where tout va bien)`. L'absence barre, quelle qu'en soit la cause.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const clientScope = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();

describe("[revue 1-4] le seuil des 18 ans tient SANS date déclarée", () => {
  const sansDate = { email: `mnd-nul-${t}@exemple.fr`, password: "test-mnd-123!", id: "" };
  const majeure = { email: `mnd-adu-${t}@exemple.fr`, password: "test-mnd-456!", id: "" };

  beforeAll(async () => {
    for (const u of [sansDate, majeure]) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      });
      if (error) throw new Error(`createUser: ${error.message}`);
      u.id = data.user!.id;
    }
    // Le témoin : une adulte qui a répondu. Elle doit continuer à passer partout.
    const { error } = await admin
      .from("utilisatrice")
      .update({ date_naissance: "1990-01-01" })
      .eq("id", majeure.id);
    if (error) throw new Error(`date_naissance: ${error.message}`);
  });

  afterAll(async () => {
    for (const u of [sansDate, majeure]) if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("⚠️ un compte SANS date de naissance est barré des tables art. 9", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: sansDate.email, password: sansDate.password });

    // L'état de départ, mesuré : rien ne la signale, et c'est tout le problème.
    const { data: ligne } = await c
      .from("utilisatrice")
      .select("date_naissance, mineur_detecte, barriere_minorite_le")
      .eq("id", sansDate.id)
      .single();
    expect(ligne?.date_naissance, "le scénario exige une date absente").toBeNull();
    expect(ligne?.mineur_detecte).toBe(false);
    expect(ligne?.barriere_minorite_le).toBeNull();

    // 1. Le consentement — le seul geste hors-application du scénario d'attaque.
    const { error: eCons } = await c.from("consentement").insert({
      utilisatrice_id: sansDate.id,
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: true,
    });
    expect(
      eCons,
      "un consentement art. 9 posé sans qu'aucune majorité soit établie",
    ).not.toBeNull();

    // 2. Et la table art. 9 elle-même, quoi qu'il arrive au consentement.
    const { error: eTemoin } = await c
      .from("art9_temoin")
      .insert({ utilisatrice_id: sansDate.id, note: "sans date déclarée" });
    expect(eTemoin, "de l'art. 9 écrit par un compte d'âge inconnu").not.toBeNull();

    await c.auth.signOut();
  });

  it("le prédicat rend VRAI pour ce compte — c'est lui qui porte la garde", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: sansDate.email, password: sansDate.password });
    const { data } = await c.rpc("est_barre_minorite");
    expect(data, "`est_barre_minorite()` doit barrer une majorité non établie").toBe(true);
    await c.auth.signOut();
  });

  it("⚠️ et une ADULTE qui a répondu passe toujours — la garde n'a pas fermé le produit", async () => {
    // LE CONTRÔLE QUI COMPTE AUTANT QUE LE RESTE. Une garde qui barre tout le monde est une panne,
    // pas une protection. L'ordre nominal de l'entrée pose la date AVANT le consentement
    // (`etapeOnboarding` : naissance → consentement), donc ce chemin-là doit rester intact.
    const c = clientScope();
    await c.auth.signInWithPassword({ email: majeure.email, password: majeure.password });

    expect((await c.rpc("est_barre_minorite")).data).toBe(false);

    const { error: eCons } = await c.from("consentement").insert({
      utilisatrice_id: majeure.id,
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: true,
    });
    expect(eCons, "l'adulte consentante doit pouvoir consentir").toBeNull();

    const { error: eTemoin } = await c
      .from("art9_temoin")
      .insert({ utilisatrice_id: majeure.id, note: "adulte déclarée" });
    expect(eTemoin, "l'adulte consentante doit pouvoir écrire").toBeNull();

    await c.auth.signOut();
  });
});
