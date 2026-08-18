import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * synthese-seffcae.test.ts — UNE SYNTHÈSE S'EFFACE AUSSI
 * (revue des Epics 1 à 4, trouvaille #8 · RGPD art. 17 · migration 0073).
 *
 * ══ CE QUI ÉTAIT GRAVÉ ═══════════════════════════════════════════════════════════════════════
 *
 * Le commentaire de la table (0029) le disait sans y voir un défaut : « Une utilisatrice ne peut ni
 * forger, ni corriger, ni effacer sa synthèse — l'effacement passera par FR-067 ». FR-067 efface le
 * COMPTE ENTIER. La 6.5 a donné à `fait_extrait` sa correction et sa suppression une par une ; la
 * synthèse est restée la seule chose qu'Anam écrit SUR elle et qu'elle ne peut retirer qu'en
 * supprimant tout — l'arbre, les branches, deux ans de journal — pour un texte de quinze lignes.
 *
 * ══ CE QUE CE FICHIER PROUVE, ET DANS QUEL ORDRE ═════════════════════════════════════════════
 *
 * Frappe un Supabase LOCAL réel, parce que c'est le seul angle qui compte : `authenticated` détient
 * les sept privilèges DML sur `public.synthese`. Une garde écrite ailleurs que dans la policy, la
 * contrainte ou le trigger ne garde rien — un PATCH PostgREST direct la contourne.
 *
 *   • elle peut effacer la sienne, et le contenu part vraiment ;
 *   • elle ne peut PAS réécrire le récit (le `with check` exige le vide) ;
 *   • elle ne peut PAS toucher à celle d'une autre ;
 *   • elle ne peut PAS déplacer `periode_fin` au passage — c'est le FILIGRANE de la prochaine
 *     synthèse, et le pousser à 2099 priverait quelqu'un de toute synthèse future, sans un signal ;
 *   • la ligne SURVIT, vide : la supprimer ferait reculer le filigrane, donc re-raconterait la
 *     période — c'est-à-dire réécrirait ce qu'elle vient de retirer (AD-18).
 */

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();

type Compte = { id: string; client: SupabaseClient };

async function creerCompte(suffixe: string): Promise<Compte> {
  const email = `syn8-${suffixe}-${t}@exemple.test`;
  const motDePasse = "MotDePasseDeTest!2026";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`création impossible : ${error?.message}`);
  const client = clientScope();
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: motDePasse });
  if (e2) throw new Error(`connexion impossible : ${e2.message}`);
  return { id: data.user.id, client };
}

/** Pose une synthèse comme l'ordonnanceur le fait — sous `service_role`. */
async function poserSynthese(utilisatriceId: string, debut: string, fin: string, contenu: string) {
  const { data, error } = await admin
    .from("synthese")
    .insert({ utilisatrice_id: utilisatriceId, periode_debut: debut, periode_fin: fin, contenu })
    .select("id")
    .single();
  if (error) throw new Error(`pose impossible : ${error.message}`);
  return data.id as string;
}

const relire = async (id: string) => {
  const { data } = await admin
    .from("synthese")
    .select("contenu, supprime_le, periode_fin")
    .eq("id", id)
    .maybeSingle<{ contenu: string; supprime_le: string | null; periode_fin: string }>();
  return data;
};

let elle: Compte;
let autre: Compte;

beforeAll(async () => {
  elle = await creerCompte("elle");
  autre = await creerCompte("autre");
});
afterAll(async () => {
  if (elle) await admin.auth.admin.deleteUser(elle.id);
  if (autre) await admin.auth.admin.deleteUser(autre.id);
});

describe("[#8] elle peut retirer un récit qu'elle ne reconnaît pas", () => {
  it("[LE CŒUR] effacer vide le contenu et pose la date — sous SA session", async () => {
    const id = await poserSynthese(elle.id, "2026-05-01T00:00:00Z", "2026-05-08T00:00:00Z", "un récit d'elle");
    const { error } = await elle.client
      .from("synthese")
      .update({ contenu: "", supprime_le: new Date().toISOString() })
      .eq("id", id);
    expect(error, "elle doit pouvoir retirer son propre récit").toBeNull();

    const apres = await relire(id);
    expect(apres?.contenu, "le contenu doit être VRAIMENT parti").toBe("");
    expect(apres?.supprime_le, "la ligne doit porter la date du geste").not.toBeNull();
  });

  it("[LE FILIGRANE] la LIGNE survit — l'effacer ferait re-raconter la période", async () => {
    // `materiau_synthese` lit `max(periode_fin)` comme point de départ de la prochaine synthèse.
    // Une suppression physique le ferait reculer, et la synthèse suivante réécrirait, à neuf, le
    // récit qu'elle venait de retirer. C'est la résurrection qu'AD-18 interdit.
    const id = await poserSynthese(elle.id, "2026-06-01T00:00:00Z", "2026-06-08T00:00:00Z", "à effacer");
    await elle.client.from("synthese").update({ contenu: "", supprime_le: new Date().toISOString() }).eq("id", id);
    expect(await relire(id), "la pierre tombale doit rester").not.toBeNull();

    // Et un DELETE sous JWT est refusé : aucune policy `delete` n'existe.
    await elle.client.from("synthese").delete().eq("id", id);
    expect(await relire(id), "un DELETE direct a emporté le filigrane").not.toBeNull();
  });
});

describe("[#8] ce que la policy REFUSE — et c'est là que vit la garde", () => {
  it("[L'EXPLOIT] elle ne peut pas RÉÉCRIRE le récit en visant sa propre ligne", async () => {
    // ⚠️ LE GESTE OFFERT EST L'EFFACEMENT, PAS LA CORRECTION. Réécrire à la main ce qu'un modèle a
    // écrit d'elle produirait un texte hybride dont plus personne ne saurait dire qui l'a produit.
    // Ce qui se corrige est une couche plus bas : les FAITS (6.5), d'où la suivante sera écrite.
    const id = await poserSynthese(elle.id, "2026-07-01T00:00:00Z", "2026-07-08T00:00:00Z", "le vrai récit");
    const { error } = await elle.client
      .from("synthese")
      .update({ contenu: "ce que j'aurais préféré lire", supprime_le: new Date().toISOString() })
      .eq("id", id);
    expect(error, "réécrire le récit doit être refusé").not.toBeNull();
    expect((await relire(id))?.contenu).toBe("le vrai récit");
  });

  it("[L'EXPLOIT] vider SANS poser la date est refusé — une ligne vide qui passe pour vivante", async () => {
    // Sinon `/synthese` afficherait « il n'y en a pas encore » à quelqu'un qui en a trente.
    const id = await poserSynthese(elle.id, "2026-07-08T00:00:00Z", "2026-07-15T00:00:00Z", "un récit");
    const { error } = await elle.client.from("synthese").update({ contenu: "" }).eq("id", id);
    expect(error, "vider sans marquer doit être refusé").not.toBeNull();
    expect((await relire(id))?.contenu).toBe("un récit");
  });

  it("[L'EXPLOIT] le récit d'une AUTRE est hors d'atteinte", async () => {
    const id = await poserSynthese(autre.id, "2026-08-01T00:00:00Z", "2026-08-08T00:00:00Z", "le récit d'une autre");
    await elle.client
      .from("synthese")
      .update({ contenu: "", supprime_le: new Date().toISOString() })
      .eq("id", id);
    expect((await relire(id))?.contenu, "le récit d'une autre a été effacé").toBe("le récit d'une autre");
  });

  it("[L'EXPLOIT QUI COÛTE LE PLUS CHER] `periode_fin` ne bouge pas au passage", async () => {
    // ⚠️ UN `with check` NE VOIT PAS `OLD`. La policy autorise l'UPDATE qui vide et marque ; elle ne
    // peut rien dire des AUTRES colonnes. Un PATCH direct qui pousse `periode_fin` à 2099 passe la
    // policy ET la contrainte — et déplace le filigrane. Cette personne ne reçoit plus jamais de
    // synthèse, et rien ne le signale : le job la trouve à jour. D'où le trigger.
    const id = await poserSynthese(elle.id, "2026-09-01T00:00:00Z", "2026-09-08T00:00:00Z", "un récit");
    const { error } = await elle.client
      .from("synthese")
      .update({ contenu: "", supprime_le: new Date().toISOString(), periode_fin: "2099-01-01T00:00:00Z" })
      .eq("id", id);
    expect(error, "déplacer le filigrane doit être refusé").not.toBeNull();
    expect((await relire(id))?.periode_fin, "le filigrane a bougé").toContain("2026-09-08");
  });

  it("on n'efface pas deux fois — le `using` exclut les pierres tombales", async () => {
    const id = await poserSynthese(elle.id, "2026-10-01T00:00:00Z", "2026-10-08T00:00:00Z", "un récit");
    const premiere = new Date("2026-10-09T00:00:00Z").toISOString();
    await elle.client.from("synthese").update({ contenu: "", supprime_le: premiere }).eq("id", id);
    await elle.client
      .from("synthese")
      .update({ contenu: "", supprime_le: new Date("2027-01-01T00:00:00Z").toISOString() })
      .eq("id", id);
    expect((await relire(id))?.supprime_le, "la date du geste a été redéplacée").toContain("2026-10-09");
  });
});

describe("[#8] la contrainte lie aussi `service_role`, que la RLS ne borne pas", () => {
  it("l'ordonnanceur lui-même ne peut pas écrire une ligne bâtarde", async () => {
    // Une pierre tombale qui aurait gardé son texte est une suppression qui n'efface rien ; une ligne
    // vide non marquée est un blanc que l'écran rendrait comme « il n'y en a pas encore ».
    const tombeePleine = await admin.from("synthese").insert({
      utilisatrice_id: elle.id,
      periode_debut: "2026-11-01T00:00:00Z",
      periode_fin: "2026-11-08T00:00:00Z",
      contenu: "du texte",
      supprime_le: new Date().toISOString(),
    });
    expect(tombeePleine.error?.message, "une tombe qui a gardé son texte").toMatch(
      /synthese_tombstone_est_vide/,
    );

    const videNonMarquee = await admin.from("synthese").insert({
      utilisatrice_id: elle.id,
      periode_debut: "2026-11-08T00:00:00Z",
      periode_fin: "2026-11-15T00:00:00Z",
      contenu: "   \n\t  ",
    });
    // ⚠️ CE CAS-CI A ATTRAPÉ UNE RÉGRESSION QUE J'AI ÉCRITE. La première version de 0073 utilisait
    // `btrim(contenu)` sans second argument — qui ne retire QUE les espaces, pas les retours à la
    // ligne. C'est le défaut que la migration 0032 existait pour corriger, réintroduit mot pour mot.
    expect(videNonMarquee.error?.message, "un blanc qui n'est pas marqué effacé").toMatch(
      /synthese_tombstone_est_vide/,
    );
  });
});
