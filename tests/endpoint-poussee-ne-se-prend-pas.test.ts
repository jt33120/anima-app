import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * endpoint-poussee-ne-se-prend-pas.test.ts — ON NE PREND PAS L'APPAREIL DE QUELQU'UN D'AUTRE
 * (revue adversariale du 2026-08-18, R7 et R26).
 *
 * ══ CE QUI ÉTAIT POSSIBLE ═════════════════════════════════════════════════════════════════════
 *
 * `abonner_poussee` est `security definer`, accordée à `authenticated`, et son commentaire affirmait
 * sa propre sûreté :
 *
 *     « CETTE FONCTION N'A PAS DE PARAMÈTRE `p_utilisatrice`, ET C'EST TOUTE SA SÛRETÉ. »
 *
 * C'était vrai du SUJET de l'insertion — on ne peut abonner que soi-même — et faux de l'OBJET de la
 * suppression, qui est un paramètre entièrement fourni par l'appelante :
 *
 *     delete from public.abonnement_poussee where endpoint = p_endpoint;
 *
 * Aucune clause de propriété. `security definer` ignore la RLS. Il suffisait donc de connaître
 * l'endpoint de quelqu'un pour prendre son appareil — et l'endpoint voyage EN CLAIR dans l'export
 * RGPD de cette personne (0057), ainsi que dans les journaux du service de poussée.
 *
 * ══ CE QUE ÇA COÛTAIT, ET C'EST PIRE QUE « ELLE NE REÇOIT PLUS » ══════════════════════════════
 *
 * L'adaptateur POSTe ZÉRO OCTET (`lib/poussee/adaptateurs/web-push.ts` : « `p256dh` et `auth` de
 * l'abonnement ne servent donc PAS ici »). Les clés forgées par l'attaquante n'ont donc aucune
 * importance pour la livraison : seul l'endpoint compte.
 *
 * Après la reprise, le job du socle lit `endpoints_poussee(attaquante)` et POUSSE SUR L'APPAREIL DE
 * LA VICTIME, à l'heure que l'attaquante choisit librement (`preference_socle.heure = 3`, sa propre
 * ligne, sa propre policy). Le téléphone de quelqu'un sonne à trois heures du matin, tous les jours,
 * et cette personne n'a plus aucune ligne en base pour l'expliquer : `/reglages` lui affiche
 * « aucun appareil ».
 *
 * ══ LA RÉPARATION, ET POURQUOI ELLE NE CASSE PAS LE CAS LÉGITIME ══════════════════════════════
 *
 * Le cas légitime est réel : deux comptes sur un même navigateur reçoivent LE MÊME endpoint, qui
 * appartient à l'appareil. Exiger `utilisatrice_id = auth.uid()` le casserait.
 *
 * Le discriminant existait déjà, et le dépôt l'avait même écrit ailleurs. `0057_export_donnees.sql`
 * retire `cle_p256dh` et `cle_auth` de l'export au motif que ce sont « des CAPACITÉS — de quoi la
 * désabonner sans être elle ». Autrement dit : qui possède l'appareil connaît les clés, qui a
 * seulement lu un export ne les connaît pas.
 *
 * Or `pushManager.subscribe()` rend au SECOND compte du même navigateur exactement la même
 * souscription — même endpoint, mêmes clés. La reprise est donc conditionnée à la présentation des
 * clés, et le cas légitime passe sans rien changer.
 *
 * Effet de bord voulu : `endpoint` cesse d'être une capacité, donc R26 (« l'export retire la
 * mauvaise colonne ») tombe avec R7, sans toucher à l'export.
 */

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const endpointDe = (s: string) => `https://web.push.apple.com/anam-r7-${s}-${t}`;
/** Les clés de l'appareil de la victime — ce que seul son navigateur connaît. */
const SES_CLES = { p256dh: "B".repeat(87), auth: "A".repeat(22) };
/** Ce qu'une attaquante peut fabriquer : de la forme valide, et rien de plus. */
const CLES_FORGEES = { p256dh: "C".repeat(87), auth: "D".repeat(22) };

async function creerCompte(suffixe: string) {
  const email = `r7-${suffixe}-${t}@exemple.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "MotDePasseDeTest!2026",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`création impossible : ${error?.message}`);
  const client = clientScope();
  const { error: e2 } = await client.auth.signInWithPassword({
    email,
    password: "MotDePasseDeTest!2026",
  });
  if (e2) throw new Error(`connexion impossible : ${e2.message}`);
  return { id: data.user.id, client };
}

const abonner = (
  u: { client: ReturnType<typeof clientScope> },
  endpoint: string,
  cles: { p256dh: string; auth: string },
) => u.client.rpc("abonner_poussee", { p_endpoint: endpoint, p_p256dh: cles.p256dh, p_auth: cles.auth });

const proprietaireDe = async (endpoint: string) => {
  const { data } = await admin
    .from("abonnement_poussee")
    .select("utilisatrice_id")
    .eq("endpoint", endpoint);
  return (data ?? []).map((l) => l.utilisatrice_id as string);
};

describe("[R7] l'endpoint d'une autre ne se reprend pas sans ses clés", () => {
  it("[L'EXPLOIT] connaître l'endpoint NE SUFFIT PLUS à prendre l'appareil", async () => {
    const berenice = await creerCompte("victime");
    const mallory = await creerCompte("attaquante");
    const endpoint = endpointDe("vole");
    try {
      expect((await abonner(berenice, endpoint, SES_CLES)).error).toBeNull();

      // Mallory a lu l'endpoint dans l'export RGPD de Bérénice. Elle n'a pas les clés — l'export les
      // retire, précisément parce que ce sont des capacités.
      const { error } = await abonner(mallory, endpoint, CLES_FORGEES);
      expect(error, "la reprise sans les clés doit ÉCHOUER, bruyamment").not.toBeNull();

      // Et surtout : l'appareil est resté à sa propriétaire. C'est la seule assertion qui compte —
      // un refus qui laisserait quand même la ligne supprimée coupe la victime tout autant.
      expect(await proprietaireDe(endpoint), "l'appareil a changé de main").toEqual([berenice.id]);
    } finally {
      await admin.auth.admin.deleteUser(berenice.id);
      await admin.auth.admin.deleteUser(mallory.id);
    }
  });

  it("[LES DEUX CLÉS, PAS UNE] connaître la moitié des clés ne suffit pas non plus", async () => {
    // ⚠️ CE TEST EST NÉ D'UN MUTANT SURVIVANT. La garde ne comparait que `cle_p256dh` et restait
    // verte : mon attaquante forgeait les DEUX clés, donc le refus venait de la première et la
    // seconde n'était jamais éprouvée. Un test qui passe pour une raison qu'il ne mesure pas.
    //
    // Les deux clés ne jouent pas le même rôle dans le chiffrement d'un message poussé, et rien ne
    // garantit qu'elles fuient ensemble. On exige les deux, et on le prouve dans les deux sens.
    for (const [cle, nom, cles] of [
      ["p256dh", "p256dh volée, auth forgée", { p256dh: SES_CLES.p256dh, auth: CLES_FORGEES.auth }],
      ["auth", "auth volée, p256dh forgée", { p256dh: CLES_FORGEES.p256dh, auth: SES_CLES.auth }],
    ] as const) {
      // ⚠️ UN IDENTIFIANT PROPRE, PAS UNE TRANCHE DE LA PHRASE. La première version fabriquait
      // l'adresse avec `nom.slice(0, 6)`, ce qui donnait « auth v » — espace compris — et Supabase
      // refusait l'adresse. Le test échouait donc AVANT d'atteindre ce qu'il mesure : rouge pour la
      // mauvaise raison, ce qui ne vaut pas mieux que vert pour la mauvaise raison.
      const berenice = await creerCompte(`moitie-${cle}`);
      const mallory = await creerCompte(`moitie-att-${cle}`);
      const endpoint = endpointDe(`moitie-${cle}`);
      try {
        await abonner(berenice, endpoint, SES_CLES);
        const { error } = await abonner(mallory, endpoint, cles);
        expect(error, `${nom} : la reprise a réussi`).not.toBeNull();
        expect(await proprietaireDe(endpoint), `${nom} : l'appareil a changé de main`).toEqual([
          berenice.id,
        ]);
      } finally {
        await admin.auth.admin.deleteUser(berenice.id);
        await admin.auth.admin.deleteUser(mallory.id);
      }
    }
  });

  it("[LE CONTRÔLE POSITIF] deux comptes sur le MÊME navigateur : la reprise marche encore", async () => {
    // ⚠️ SANS CE TEST, LA RÉPARATION SERAIT UNE RÉGRESSION. Le navigateur rend la MÊME souscription
    // au second compte — même endpoint, mêmes clés. C'est ce qui distingue la possession de la
    // simple connaissance, et c'est ce qui fait que le cas banal continue de passer.
    const a = await creerCompte("navig-a");
    const b = await creerCompte("navig-b");
    const endpoint = endpointDe("partage");
    try {
      expect((await abonner(a, endpoint, SES_CLES)).error).toBeNull();
      expect(
        (await abonner(b, endpoint, SES_CLES)).error,
        "le second compte du même navigateur ne recevra jamais rien",
      ).toBeNull();
      expect(await proprietaireDe(endpoint)).toEqual([b.id]);
    } finally {
      await admin.auth.admin.deleteUser(a.id);
      await admin.auth.admin.deleteUser(b.id);
    }
  });

  it("[L'AUTRE CONTRÔLE] se réabonner soi-même marche, même avec des clés RENOUVELÉES", async () => {
    // Un navigateur peut faire tourner ses clés (`pushsubscriptionchange`) en gardant son endpoint.
    // La propriétaire, elle, n'a rien à prouver : c'est déjà sa ligne.
    const u = await creerCompte("moi-meme");
    const endpoint = endpointDe("renouvelle");
    try {
      expect((await abonner(u, endpoint, SES_CLES)).error).toBeNull();
      expect(
        (await abonner(u, endpoint, CLES_FORGEES)).error,
        "on ne peut plus renouveler ses propres clés",
      ).toBeNull();
      expect(await proprietaireDe(endpoint)).toEqual([u.id]);
    } finally {
      await admin.auth.admin.deleteUser(u.id);
    }
  });

  it("[LE BORD] un endpoint libre s'abonne normalement — la garde ne ferme pas le cas nominal", async () => {
    const u = await creerCompte("nominal");
    const endpoint = endpointDe("libre");
    try {
      expect((await abonner(u, endpoint, SES_CLES)).error).toBeNull();
      expect(await proprietaireDe(endpoint)).toEqual([u.id]);
      // La préférence naît avec l'abonnement (patron `jeton_courriel`) — sans elle, la sélection ne
      // trouverait jamais personne.
      const { data } = await admin
        .from("preference_socle")
        .select("heure")
        .eq("utilisatrice_id", u.id);
      expect(data ?? []).toHaveLength(1);
    } finally {
      await admin.auth.admin.deleteUser(u.id);
    }
  });

  it("[LA DOCTRINE] un DELETE direct sous JWT ne touche toujours que ses propres lignes", async () => {
    // La RPC n'est pas la seule porte : `authenticated` a le grant DELETE sur la table. La policy
    // `abonnement_poussee_proprietaire_retrait` est ce qui tient — on le vérifie, plutôt que de le
    // supposer, parce que c'est exactement l'écart qui a produit R7.
    const berenice = await creerCompte("victime-2");
    const mallory = await creerCompte("attaquante-2");
    const endpoint = endpointDe("delete-direct");
    try {
      await abonner(berenice, endpoint, SES_CLES);
      await mallory.client.from("abonnement_poussee").delete().eq("endpoint", endpoint);
      expect(await proprietaireDe(endpoint), "un DELETE direct a coupé quelqu'un d'autre").toEqual([
        berenice.id,
      ]);
    } finally {
      await admin.auth.admin.deleteUser(berenice.id);
      await admin.auth.admin.deleteUser(mallory.id);
    }
  });
});
