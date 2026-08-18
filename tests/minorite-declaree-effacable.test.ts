import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { DELAI_SUPPRESSION_MINORITE_JOURS, echeanceSuppression } from "@/lib/safety/barriere-minorite";

/**
 * minorite-declaree-effacable.test.ts — LE COMPTE D'UNE MINEURE DÉCLARÉE FINIT PAR S'EFFACER.
 *
 * ══ LE DÉFAUT, TROUVÉ PAR LA REVUE DES EPICS 1 À 4 (2026-08-18) ═════════════════════════════════
 *
 * Ce dépôt distingue DEUX minorités (0042, 0061) : DÉCLARÉE au seuil d'âge (`mineur_detecte`,
 * FR-070) et DÉTECTÉE après coup (`barriere_minorite_le`, FR-071). 0061 a réparé le second chemin.
 * Le premier n'a jamais posé d'échéance de suppression — et 0061 le dit lui-même en passant :
 * « `naissance/actions.ts`, qui ne pose AUCUNE échéance ».
 *
 * Pour une adolescente qui répond honnêtement à la question de son âge, cela donnait :
 *   `mineur_detecte = true`, `echeance_suppression = null` ;
 *   `comptes_a_prevenir` l'exclut (« la minorité a son propre chemin ») ;
 *   `comptes_a_effacer` exige une échéance, qu'elle n'a pas.
 *
 * **Son compte n'aurait jamais été effacé.** Il porte son adresse e-mail et le fait qu'elle a moins
 * de dix-huit ans — une donnée personnelle de mineure, conservée sans limite ni chemin d'effacement,
 * pour avoir dit la vérité. Le trou vivait entre deux stories, personne ne l'habitait.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-minorite-declaree-123!";

async function creerCompte(suffixe: string): Promise<{ id: string; email: string }> {
  const email = `md-${suffixe}-${t}@exemple.fr`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  return { id: data.user!.id, email };
}

const comptes: string[] = [];

describe("[revue 1-4, #11] une minorité déclarée porte son échéance", () => {
  let u: { id: string; email: string };

  beforeAll(async () => {
    u = await creerCompte("nominal");
    comptes.push(u.id);
  });
  afterAll(async () => {
    for (const id of comptes) await admin.auth.admin.deleteUser(id);
  });

  it("⚠️ `declarer_minorite` pose LES DEUX — sans l'échéance, le compte est hors d'atteinte", async () => {
    const { error } = await admin.rpc("declarer_minorite", {
      cible: u.id,
      echeance: echeanceSuppression(),
    });
    expect(error).toBeNull();
    const { data } = await admin
      .from("utilisatrice")
      .select("mineur_detecte, echeance_suppression")
      .eq("id", u.id)
      .single();
    expect(data?.mineur_detecte).toBe(true);
    expect(data?.echeance_suppression, "un compte de mineure que rien n'effacera jamais").not.toBeNull();
  });

  it("l'échéance vient du TypeScript, jamais d'un littéral SQL (AD-14)", async () => {
    // Le SQL reçoit une date déjà calculée. Un « 30 » figé dans la fonction ferait deux sources pour
    // une même durée — et la première qui bouge laisserait l'autre en arrière, en silence.
    const { data } = await admin
      .from("utilisatrice")
      .select("echeance_suppression")
      .eq("id", u.id)
      .single();
    const attendue = new Date();
    attendue.setUTCDate(attendue.getUTCDate() + DELAI_SUPPRESSION_MINORITE_JOURS);
    expect(data?.echeance_suppression).toBe(attendue.toISOString().slice(0, 10));
  });

  it("idempotent : une seconde déclaration ne REPOUSSE pas l'échéance", async () => {
    // Sinon quelqu'un qui rouvre la page repousserait indéfiniment sa propre suppression.
    const { data: avant } = await admin
      .from("utilisatrice").select("echeance_suppression").eq("id", u.id).single();
    const plusTard = new Date();
    plusTard.setUTCDate(plusTard.getUTCDate() + 900);
    await admin.rpc("declarer_minorite", { cible: u.id, echeance: plusTard.toISOString().slice(0, 10) });
    const { data: apres } = await admin
      .from("utilisatrice").select("echeance_suppression").eq("id", u.id).single();
    expect(apres?.echeance_suppression).toBe(avant?.echeance_suppression);
  });

  it("⚠️ et le moteur de rétention la VOIT — la boucle est bouclée", async () => {
    // `comptes_a_effacer` ne demande qu'une échéance échue. C'est la preuve que l'échéance posée
    // suffit, et que rien d'autre ne l'exclut en chemin.
    await admin
      .from("utilisatrice")
      .update({ echeance_suppression: "2020-01-01" })
      .eq("id", u.id);
    const { data } = await admin.rpc("comptes_a_effacer", { p_max: 500 });
    const vus = (data as Array<{ utilisatrice_id: string }>).map((l) => l.utilisatrice_id);
    expect(vus, "le compte reste hors de portée du moteur de rétention").toContain(u.id);
  });

  it("`trancher_echeance_suppression` l'efface sans grâce — une mineure n'est pas une inactive", async () => {
    const { data, error } = await admin.rpc("trancher_echeance_suppression", {
      p_utilisatrice_id: u.id,
      p_inactivite_mois: 18,
      p_preavis_mois: 1,
      p_fenetre_pitr_jours: 7,
    });
    expect(error).toBeNull();
    expect(data, "elle a été graciée comme une simple inactive").toBe("effacee");
  });
});

describe("[revue 1-4, #11] l'invariant : pas de minorité sans échéance", () => {
  it("⚠️ un PATCH direct sous JWT ne peut plus créer un compte indestructible", async () => {
    // ══ POURQUOI CETTE MOITIÉ COMPTE AUTANT QUE L'AUTRE ═══════════════════════════════════════
    // `authenticated` garde le privilège de colonne sur `mineur_detecte` (0041) mais ne l'a pas sur
    // `echeance_suppression`. Réparer la seule Server Action laisserait donc la porte ouverte : un
    // POST direct sur PostgREST reconstituerait exactement l'état qu'on vient de fermer — et ce
    // dépôt a payé six fois pour savoir qu'une garde qui ne vit que dans une action ne garde rien.
    const v = await creerCompte("patch");
    comptes.push(v.id);
    const c = clientScope();
    await c.auth.signInWithPassword({ email: v.email, password: MDP });
    const { error } = await c.from("utilisatrice").update({ mineur_detecte: true }).eq("id", v.id);
    expect(error, "un compte de mineure sans échéance a pu être créé sous JWT").not.toBeNull();

    const { data } = await admin
      .from("utilisatrice").select("mineur_detecte").eq("id", v.id).single();
    expect(data?.mineur_detecte, "l'état est resté à moitié écrit").toBe(false);
    await c.auth.signOut();
  });

  it("`service_role` non plus — le trigger mord tout le monde (patron 0016/0042)", async () => {
    const w = await creerCompte("srole");
    comptes.push(w.id);
    const { error } = await admin.from("utilisatrice").update({ mineur_detecte: true }).eq("id", w.id);
    expect(error, "la RLS ne borne pas service_role : seul un trigger le fait").not.toBeNull();
  });

  it("[CONTRÔLE POSITIF] poser LES DEUX ensemble passe — la garde n'a pas fermé le chemin", async () => {
    // Une garde qui barre tout le monde est une panne, pas une protection.
    const x = await creerCompte("ok");
    comptes.push(x.id);
    const { error } = await admin
      .from("utilisatrice")
      .update({ mineur_detecte: true, echeance_suppression: echeanceSuppression() })
      .eq("id", x.id);
    expect(error).toBeNull();
  });

  it("⚠️ la RPC est hors de portée d'une session — sinon on barrerait le compte d'AUTRUI", async () => {
    // ══ POURQUOI CE TEST EXISTE ══════════════════════════════════════════════════════════════════
    // La campagne de mutation a posé `grant execute … to authenticated` et il a SURVÉCU : rien ici
    // ne disait que cette porte est fermée.
    //
    // ⚠️ ET ELLE COMPTE PLUS QUE LES AUTRES, parce que `cible` est un PARAMÈTRE, pas `auth.uid()`.
    // Grantée à `authenticated`, cette fonction laisserait n'importe qui poser une barrière de
    // minorité — irréversible, et assortie d'une date de suppression — sur le compte de n'importe
    // qui d'autre. C'est le patron de 1.9 : « JAMAIS une action invocable par le client avec un uid
    // arbitraire ».
    const attaquante = await creerCompte("attaquante");
    const victime = await creerCompte("victime");
    comptes.push(attaquante.id, victime.id);

    const c = clientScope();
    await c.auth.signInWithPassword({ email: attaquante.email, password: MDP });
    const { error } = await c.rpc("declarer_minorite", {
      cible: victime.id,
      echeance: echeanceSuppression(),
    });
    expect(error, "une session a pu barrer le compte de quelqu'un d'autre").not.toBeNull();

    const { data } = await admin
      .from("utilisatrice")
      .select("mineur_detecte, echeance_suppression")
      .eq("id", victime.id)
      .single();
    expect(data?.mineur_detecte, "le compte d'autrui a été barré").toBe(false);
    expect(data?.echeance_suppression, "une suppression a été programmée sur autrui").toBeNull();
    await c.auth.signOut();
  });

  it("et la MONOTONIE tient toujours : true → false reste refusé (FR-070)", async () => {
    const y = await creerCompte("mono");
    comptes.push(y.id);
    await admin.rpc("declarer_minorite", { cible: y.id, echeance: echeanceSuppression() });
    const { error } = await admin.from("utilisatrice").update({ mineur_detecte: false }).eq("id", y.id);
    expect(error, "une barrière de minorité s'est retirée").not.toBeNull();
  });
});
