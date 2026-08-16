import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { lireFilRecent, FIL_ENTREES_MAX, FIL_FENETRE_HEURES } from "@/lib/data/depot-fil";

/**
 * depot-fil.test.ts — LE FIL RETROUVÉ (QA tour 1, T3), contre le vrai Postgres.
 *
 * ⚠️ CONTRE LA VRAIE BASE, ET PAS SUR DOUBLURE. La propriété qui compte n'est pas « la requête est
 * bien formée » — c'est « B ne voit pas le fil de A ». Elle est portée par la RLS d'`entree_journal`,
 * et une doublure de client la rendrait invérifiable par construction : on prouverait que le faux
 * client rend ce qu'on lui a dit de rendre.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-fil-123!";

async function creerUtilisatrice(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  return data.user!.id;
}

async function session(email: string): Promise<SupabaseClient> {
  const c = clientScope();
  const { error } = await c.auth.signInWithPassword({ email, password: MDP });
  if (error) throw new Error(`signIn: ${error.message}`);
  return c;
}

async function consentir(id: string) {
  await admin.from("consentement").delete().eq("utilisatrice_id", id);
  const { error } = await admin
    .from("consentement")
    .insert({ utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true });
  if (error) throw new Error(`consentir: ${error.message}`);
}

/** Grave un tour. `ilYAHeures` place l'entrée dans le passé — c'est la fenêtre qu'on éprouve. */
async function graver(id: string, role: "utilisatrice" | "anam", contenu: string, ilYAHeures = 0) {
  const { error } = await admin.from("entree_journal").insert({
    utilisatrice_id: id,
    role,
    contenu,
    cle_tour: `fil-${t}-${Math.random()}`,
    cree_le: new Date(Date.now() - ilYAHeures * 3_600_000).toISOString(),
  });
  if (error) throw new Error(`graver: ${error.message}`);
}

async function purger(id: string) {
  if (!id) return;
  await admin.from("entree_journal").delete().eq("utilisatrice_id", id);
  await admin.from("consentement").delete().eq("utilisatrice_id", id);
  await admin.auth.admin.deleteUser(id);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════

describe("[QA T3] le fil se retrouve — dans le bon ORDRE, et dans la bonne fenêtre", () => {
  const email = `fil-${t}@exemple.test`;
  let id = "";
  let c: SupabaseClient;

  beforeAll(async () => {
    id = await creerUtilisatrice(email);
    await consentir(id);
    c = await session(email);
  });
  afterAll(async () => purger(id));

  it("[CONTRÔLE NÉGATIF] un compte sans rien rend un fil VIDE", async () => {
    expect(await lireFilRecent(c)).toEqual([]);
  });

  it("[LE CŒUR] l'ordre rendu est l'ordre de LECTURE — le plus ancien en premier", async () => {
    // Mutation-cible : retirer le `.reverse()`. La conversation s'afficherait à l'envers, ce qui est
    // pire qu'un fil vide : elle se lirait comme un dialogue où Anam répond avant la question.
    await graver(id, "utilisatrice", "premier message", 3);
    await graver(id, "anam", "première réponse", 2.9);
    await graver(id, "utilisatrice", "second message", 1);
    await graver(id, "anam", "seconde réponse", 0.9);

    expect((await lireFilRecent(c)).map((x) => x.texte)).toEqual([
      "premier message",
      "première réponse",
      "second message",
      "seconde réponse",
    ]);
  });

  it("les rôles traversent intacts — un tour d'Anam reste un tour d'Anam", async () => {
    expect((await lireFilRecent(c)).map((x) => x.role)).toEqual(["utilisatrice", "anam", "utilisatrice", "anam"]);
  });

  it("[LE CŒUR] ce qui est HORS FENÊTRE ne revient pas", async () => {
    // Mutation-cible : retirer le `.gte("cree_le", …)`. Le fil rendrait la conversation d'il y a un
    // mois à chaque ouverture — et vingt échanges anciens repousseraient hors de l'écran ce qui vient
    // d'être écrit.
    await graver(id, "utilisatrice", "il y a trois jours", FIL_FENETRE_HEURES + 48);
    const textes = (await lireFilRecent(c)).map((x) => x.texte);
    expect(textes, "l'ancien est écarté").not.toContain("il y a trois jours");
    expect(textes.length, "…et le récent est toujours là").toBe(4);
  });

  it("[LE CŒUR] au-delà de la borne, ce sont les PLUS RÉCENTES qui restent", async () => {
    // ⚠️ Mutation-cible : trier croissant avec la limite. On rendrait alors les quarante PREMIÈRES
    // entrées de la fenêtre — donc, pour quelqu'un de bavard, la conversation d'il y a vingt-trois
    // heures, et pas celle qu'elle vient d'écrire. L'ordre de la REQUÊTE et l'ordre de LECTURE ne
    // sont pas le même ordre, et c'est le piège de cette fonction.
    await admin.from("entree_journal").delete().eq("utilisatrice_id", id);
    for (let i = 0; i < FIL_ENTREES_MAX + 6; i++) {
      await graver(id, "utilisatrice", `tour ${i}`, (FIL_ENTREES_MAX + 6 - i) * 0.2);
    }
    const fil = await lireFilRecent(c);
    expect(fil).toHaveLength(FIL_ENTREES_MAX);
    expect(fil.at(-1)?.texte, "le dernier écrit doit être le dernier lu").toBe(`tour ${FIL_ENTREES_MAX + 5}`);
    expect(fil[0].texte, "les six plus anciens sont tombés").toBe("tour 6");
  });
});

describe("[QA T3] le fil est CLOISONNÉ — c'est la propriété qui interdit la doublure", () => {
  const emailA = `fil-a-${t}@exemple.test`;
  const emailB = `fil-b-${t}@exemple.test`;
  let idA = "";
  let idB = "";

  beforeAll(async () => {
    idA = await creerUtilisatrice(emailA);
    idB = await creerUtilisatrice(emailB);
    for (const id of [idA, idB]) await consentir(id);
    await graver(idA, "utilisatrice", "ce que A n'a dit à personne");
  });
  afterAll(async () => {
    await purger(idA);
    await purger(idB);
  });

  it("[LE CŒUR] B ne voit RIEN du fil de A", async () => {
    const cB = await session(emailB);
    expect(await lireFilRecent(cB)).toEqual([]);
    // …et le contrôle positif, sans lequel le refus ci-dessus serait vrai sur une base vide.
    const cA = await session(emailA);
    expect((await lireFilRecent(cA)).map((x) => x.texte)).toEqual(["ce que A n'a dit à personne"]);
  });

  it("la lecture ne dépend d'AUCUN paramètre d'identité — seul le JWT décide", async () => {
    // `lireFilRecent(supabase)` ne prend pas d'identifiant : il n'y a aucun endroit où en passer un
    // faux. C'est la même discipline que `motifs_anam_du()` — la propriété est portée par la session,
    // pas par un argument qu'un appelant pourrait se tromper de fournir.
    expect(lireFilRecent.length, "un second paramètre serait l'instant, jamais une identité").toBeLessThanOrEqual(2);
  });
});
