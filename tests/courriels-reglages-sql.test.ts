import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sansCommentaires } from "./_absence";

/**
 * courriels-reglages-sql.test.ts — ARRÊTER LES COURRIELS DEPUIS L'APPLICATION
 * (revue Epic 6, R7 · migration 0062 · art. 21).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE CE FICHIER ÉPROUVE, ET POURQUOI IL EXISTE
 * ══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * La 4.9 avait construit le désabonnement par JETON — sans session, en un clic, RFC 8058. Correct, et
 * exigé par Gmail et Yahoo. Mais **aucun fichier de `app/` ne lisait `preference_courriel`, et aucun
 * lien ne menait à `/desabonnement`** : le seul chemin passait par un courriel déjà reçu. Qui les
 * avait supprimés, ou classés en indésirables, n'avait plus de porte.
 *
 * Sur un écran nommé « Réglages », dont l'unique geste d'arrêt dit « Ne plus rien recevoir sur cet
 * appareil », on laissait croire que tout s'arrêtait.
 *
 * ⚠️ LE TEST QUI COMPTE EST LE DERNIER BLOC : ce geste n'est gardé par RIEN. Ni consentement art. 9,
 * ni barrière de minorité, ni fenêtre de détresse. C'est le raisonnement de la 3.5 sur la
 * résiliation, et il ne se rouvre pas — `limites_levees` est vrai PENDANT un épisode de détresse.
 */

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientNu = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-courriels-123!";

interface Compte {
  id: string;
  client: ReturnType<typeof clientNu>;
}

async function creerCompte(suffixe: string): Promise<Compte> {
  const email = `courriels-${suffixe}-${t}@exemple.fr`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = data.user!.id;
  const { error: e2 } = await admin
    .from("utilisatrice")
    .update({ date_naissance: "1990-06-15" })
    .eq("id", id);
  if (e2) throw new Error(`date_naissance: ${e2.message}`);
  const client = clientNu();
  const { error: e3 } = await client.auth.signInWithPassword({ email, password: MDP });
  if (e3) throw new Error(`signIn: ${e3.message}`);
  return { id, client };
}

const refuseLeDe = async (id: string): Promise<string | null> =>
  ((await admin.from("preference_courriel").select("refuse_le").eq("utilisatrice_id", id).maybeSingle())
    .data as { refuse_le: string | null } | null)?.refuse_le ?? null;

let alice: Compte;

beforeAll(async () => {
  alice = await creerCompte("alice");
}, 60_000);

describe("[R7 · art. 21] Le chemin sous session existe, et il fait naître sa ligne", () => {
  it("[LE CŒUR] elle peut refuser AVANT d'avoir jamais reçu un courriel", async () => {
    // La ligne naît au premier ENVOI (création paresseuse, 0034). Sans cet `insert … on conflict`,
    // l'`update` ne toucherait rien et rendrait un succès creux : le réglage ne serait disponible
    // qu'APRÈS avoir subi ce qu'on veut arrêter.
    const avant = await admin.from("preference_courriel").select("utilisatrice_id").eq("utilisatrice_id", alice.id);
    expect((avant.data ?? []).length, "la ligne existait déjà : le test ne prouve plus rien").toBe(0);

    const { error } = await alice.client.rpc("regler_mes_courriels", { p_refuse: true });
    expect(error).toBeNull();
    expect(await refuseLeDe(alice.id), "le refus n'a pas été enregistré").not.toBeNull();
  });

  it("un SECOND refus ne repousse pas la date — c'est une preuve, pas un compteur", async () => {
    const premier = await refuseLeDe(alice.id);
    expect(premier).not.toBeNull();
    await alice.client.rpc("regler_mes_courriels", { p_refuse: true });
    expect(
      await refuseLeDe(alice.id),
      "la date du jour où elle a dit non pour la première fois a été écrasée",
    ).toBe(premier);
  });

  it("elle peut REPRENDRE — un clic accidentel ne la prive pas définitivement", async () => {
    const { error } = await alice.client.rpc("regler_mes_courriels", { p_refuse: false });
    expect(error).toBeNull();
    expect(await refuseLeDe(alice.id)).toBeNull();
  });

  it("sans session, la fonction LÈVE au lieu de toucher une ligne au hasard", async () => {
    const { error } = await clientNu().rpc("regler_mes_courriels", { p_refuse: true });
    expect(error, "un client anonyme a réglé les courriels de quelqu'un").not.toBeNull();
  });

  it("un choix absent est refusé — `null` n'est ni un refus ni une reprise", async () => {
    const { error } = await alice.client.rpc("regler_mes_courriels", { p_refuse: null });
    expect(error).not.toBeNull();
  });
});

describe("[R7] La table reste fermée à l'écriture directe — le JETON n'est pas à elle", () => {
  it("[LE CŒUR] elle ne peut pas s'écrire un jeton connu d'elle seule", async () => {
    // C'est la raison d'être de la FONCTION plutôt que d'une policy d'écriture. Sous un `update`
    // ouvert, `jeton` serait à sa portée : elle pourrait se donner celui d'une autre, ou en fabriquer
    // un qu'elle contrôle. La seule colonne qu'elle a le droit de bouger est `refuse_le`.
    await alice.client.rpc("regler_mes_courriels", { p_refuse: true });
    const { data: avant } = await admin
      .from("preference_courriel")
      .select("jeton")
      .eq("utilisatrice_id", alice.id)
      .single();

    const { error } = await alice.client
      .from("preference_courriel")
      .update({ jeton: "00000000-0000-0000-0000-000000000001" })
      .eq("utilisatrice_id", alice.id);

    const { data: apres } = await admin
      .from("preference_courriel")
      .select("jeton")
      .eq("utilisatrice_id", alice.id)
      .single();
    expect(
      (apres as { jeton: string }).jeton,
      `le jeton a été réécrit sous JWT (erreur PostgREST : ${error?.message ?? "aucune"})`,
    ).toBe((avant as { jeton: string }).jeton);
  });

  it("elle LIT sa préférence — c'est ce qui permet à l'écran de dire vrai", async () => {
    const { data, error } = await alice.client
      .from("preference_courriel")
      .select("refuse_le")
      .eq("utilisatrice_id", alice.id)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data, "la policy de lecture propriétaire ne rend plus sa ligne").not.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LE BLOC QUI COMPTE — CE GESTE N'EST GARDÉ PAR RIEN, ET C'EST DÉLIBÉRÉ
// ══════════════════════════════════════════════════════════════════════════════════════════════════
//
// ⚠️ Chacun de ces trois états FERME d'autres portes du produit. Si l'un d'eux fermait aussi
// celle-ci, quelqu'un se retrouverait enfermée dans un canal qu'elle ne supporte plus — au moment
// précis où elle le supporte le moins. L'article 21 ne connaît aucune condition : l'opposition
// s'exerce, elle ne se mérite pas.
describe("[R7 · LE CŒUR] Aucun état ne peut empêcher quelqu'un de faire taire nos courriels", () => {
  it("consentement art. 9 RÉVOQUÉ — elle peut encore arrêter", async () => {
    const bob = await creerCompte("revoque");
    await admin.from("consentement_art9").insert({ utilisatrice_id: bob.id, revoque_le: new Date().toISOString() });
    const { error } = await bob.client.rpc("regler_mes_courriels", { p_refuse: true });
    expect(error, "une révocation art. 9 l'a enfermée dans nos courriels").toBeNull();
    expect(await refuseLeDe(bob.id)).not.toBeNull();
  });

  it("barrière de MINORITÉ posée — elle peut encore arrêter", async () => {
    const cleo = await creerCompte("barree");
    const { error: eb } = await admin.rpc("appliquer_barriere_minorite", {
      cible: cleo.id,
      echeance: "2099-01-01",
    });
    expect(eb, "la barrière n'a pas pu être posée : le test ne prouve rien").toBeNull();
    const { error } = await cleo.client.rpc("regler_mes_courriels", { p_refuse: true });
    expect(error, "un compte suspendu ne peut plus faire taire nos envois").toBeNull();
    expect(await refuseLeDe(cleo.id)).not.toBeNull();
  });

  it("[LE PLUS IMPORTANT] épisode de DÉTRESSE en cours — elle peut encore arrêter", async () => {
    // `limites_levees` est vrai pendant un épisode : une garde AD-9 posée ici enfermerait dans nos
    // courriels la personne la plus vulnérable du produit. Même décision qu'en 3.5 pour la
    // résiliation, et elle ne se rouvre pas.
    const dana = await creerCompte("detresse");
    const { error: ed } = await admin
      .from("episode_detresse")
      .insert({ utilisatrice_id: dana.id, niveau_max: 2 });
    expect(ed, "l'épisode n'a pas pu être ouvert : le test ne prouve rien").toBeNull();

    const { error } = await dana.client.rpc("regler_mes_courriels", { p_refuse: true });
    expect(error, "quelqu'un en détresse ne peut plus faire taire nos courriels").toBeNull();
    expect(await refuseLeDe(dana.id)).not.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA SURFACE — parce qu'un mécanisme qu'aucun écran n'atteint est exactement le défaut d'origine
// ══════════════════════════════════════════════════════════════════════════════════════════════════
//
// ⚠️ R7 N'ÉTAIT PAS UN MÉCANISME MANQUANT, C'ÉTAIT UN MÉCANISME SANS PORTE. `regler_courriels_par_jeton`
// existait depuis la 4.9 et fonctionnait ; simplement, aucun écran n'y menait. Poser 0062 sans garder
// la surface reproduirait le défaut à l'identique, un cran plus loin.
//
// Le dépouillement des commentaires est obligatoire ici : ce fichier de page EXPLIQUE en prose ce
// qu'il monte, et une garde qui lirait la prose se satisferait d'un écran vide (leçon R6).
describe("[R7] L'écran de réglages porte réellement le geste", () => {
  const PAGE = sansCommentaires(
    readFileSync(resolve(process.cwd(), "app/reglages/page.tsx"), "utf-8"),
  );

  it("[LE CŒUR] la page APPELLE l'action — l'import ne prouverait rien", () => {
    expect(PAGE, "`reglerCourriels` est importé mais plus appelé").toMatch(
      /await\s+reglerCourriels\s*\(/,
    );
  });

  it("elle LIT la préférence, sinon l'écran ne peut que deviner", () => {
    expect(PAGE).toMatch(/from\("preference_courriel"\)/);
    expect(PAGE).toMatch(/refuse_le/);
  });

  it("les deux libellés et les deux états descendent de la copie, jamais d'un littéral", () => {
    // ⚠️ ON ANCRE SUR `copie.X`, ET ICI C'EST BIEN UN USAGE — pas le piège R6. La page importe
    // `* as copie` : il n'existe AUCUNE ligne d'import nommant ces constantes, donc toute occurrence
    // de `copie.X` est un endroit où la valeur SERT. Un test de ce genre serait creux sur un fichier
    // à imports nommés ; il mord sur celui-ci.
    for (const nom of [
      "SECTION_COURRIELS",
      "DESCRIPTION_COURRIELS",
      "ETAT_COURRIELS_RECUS",
      "ETAT_COURRIELS_ARRETES",
      "ARRETER_COURRIELS",
      "REPRENDRE_COURRIELS",
      "COURRIELS_QUI_RESTENT",
    ]) {
      expect(PAGE, `« ${nom} » n'est plus rendu`).toMatch(new RegExp(`copie\\.${nom}\\b`));
    }
  });

  it("[LE CŒUR] le geste bascule — il ne sait pas QUE refuser", () => {
    // Un bouton qui poserait toujours `true` serait un aller sans retour : un clic accidentel, ou un
    // scanner de sécurité qui suit un lien, la priverait définitivement de l'annonce. C'est le
    // raisonnement de la 4.9 sur le jeton, transposé à l'écran.
    expect(PAGE).toMatch(/reglerCourriels\(!courrielsArretes\)/);
  });
});
