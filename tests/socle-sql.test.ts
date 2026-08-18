import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * socle-sql.test.ts — LES GARDES DE BASE DU SOCLE QUOTIDIEN (Story 6.2, migration 0053).
 *
 * Frappe un Supabase LOCAL réel. C'est le seul angle qui compte : `authenticated` détient les sept
 * privilèges DML sur chaque table de `public`, donc une garde écrite dans une route, une Server Action
 * ou une RPC seule ne garde rien. Ce dépôt l'a payé six fois (migrations 0041 à 0048).
 *
 * Trois blocs, et le troisième est le plus important :
 *
 *   • les deux tables neuves refusent ce qu'elles doivent refuser, y compris de la FORME ;
 *   • `socle_quotidien_du` sélectionne exactement qui il faut, et surtout ne demande PAS premium ;
 *   • `eligible_au_periodique` a été RÉÉCRITE par 0053 (extraction de `personne_joignable`), et ses
 *     CINQ refus sont éprouvés un par un. C'est la dette de 4.10 payée d'avance : réécrire cette
 *     famille de fonctions a déjà coûté une garde entière, en silence.
 */

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();

/** Un endpoint conforme à l'allowlist d'hôtes, unique par appel (l'index est unique au monde). */
const endpointDe = (suffixe: string) => `https://web.push.apple.com/anam-${suffixe}-${t}`;
const P256DH = "B".repeat(87);
const AUTH = "A".repeat(22);

/**
 * L'HEURE COURANTE À PARIS, telle que la base la calcule.
 *
 * ⚠️ `socle_quotidien_du` lit sa PROPRE horloge (c'est tout l'intérêt, voir 0053 §5) : le test ne peut
 * donc pas la lui imposer, il ne peut que s'accorder avec elle. Il reste une course d'une fraction de
 * seconde par heure — si la bascule d'heure tombe exactement entre ce calcul et l'appel. Elle est
 * assumée : elle rend le test ROUGE, jamais faussement vert.
 */
function heureParis(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hour12: false }).format(
      new Date(),
    ),
  );
}

interface Utilisatrice {
  id: string;
  client: SupabaseClient;
}

/**
 * Une utilisatrice SANS session — `createUser` et rien d'autre.
 *
 * ⚠️ Ce n'est pas une micro-optimisation. Ce fichier crée vingt-cinq comptes, et il est de loin le
 * plus lourd de la suite SQL ; seize d'entre eux ne se servent JAMAIS de leur session (les blocs de
 * sélection et d'éligibilité n'interrogent que le client admin). Chaque `signInWithPassword` inutile
 * est un aller-retour GoTrue de plus pendant que huit fichiers frappent la même pile Docker — et la
 * saturation ne se manifeste pas par une assertion fausse mais par un **502 de la passerelle**, dans
 * un fichier au hasard, à chaque passe un autre.
 *
 * C'est exactement la faute que la 6.1a a payée sept fois : un rouge qui ne vient pas d'un test. On
 * ne le règle pas en montant un délai — on retire le travail qui ne sert à rien.
 */
async function creerCompte(suffixe: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: `socle-${suffixe}-${t}@exemple.fr`,
    password: "test-socle-123!",
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = data.user!.id;
  const { error: e2 } = await admin.from("utilisatrice").update({ date_naissance: "1990-06-15" }).eq("id", id);
  if (e2) throw new Error(`date_naissance: ${e2.message}`);
  return id;
}

/** Une utilisatrice AVEC session — réservée aux tests qui éprouvent une policy sous son propre JWT. */
async function creerUtilisatrice(suffixe: string): Promise<Utilisatrice> {
  const id = await creerCompte(suffixe);
  const client = clientScope();
  const { error } = await client.auth.signInWithPassword({
    email: `socle-${suffixe}-${t}@exemple.fr`,
    password: "test-socle-123!",
  });
  if (error) throw new Error(`signIn: ${error.message}`);
  return { id, client };
}

async function consentir(id: string): Promise<void> {
  const { error } = await admin
    .from("consentement")
    .upsert(
      { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true },
      { onConflict: "utilisatrice_id" },
    );
  if (error) throw new Error(`consentement: ${error.message}`);
}

/** Joignable ET due à l'heure courante : consentement, abonnement de poussée, préférence à l'heure. */
async function rendreDue(id: string, suffixe: string, heure = heureParis()): Promise<void> {
  await consentir(id);
  const { error: e1 } = await admin
    .from("abonnement_poussee")
    .insert({ utilisatrice_id: id, endpoint: endpointDe(suffixe), cle_p256dh: P256DH, cle_auth: AUTH });
  if (e1) throw new Error(`abonnement_poussee: ${e1.message}`);
  const { error: e2 } = await admin
    .from("preference_socle")
    .upsert({ utilisatrice_id: id, heure }, { onConflict: "utilisatrice_id" });
  if (e2) throw new Error(`preference_socle: ${e2.message}`);
}

async function dues(limite = 50): Promise<string[]> {
  const { data, error } = await admin.rpc("socle_quotidien_du", { p_limite: limite });
  if (error) throw new Error(`socle_quotidien_du: ${error.message}`);
  return (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => r.utilisatrice_id as string);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 1. LES DEUX TABLES NEUVES — la garde d'écriture vit dans la policy, la garde de forme dans le CHECK
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.2] `preference_socle` : sa propre heure, et rien d'autre", () => {
  let moi: Utilisatrice;
  let elle: Utilisatrice;

  beforeAll(async () => {
    moi = await creerUtilisatrice("pref-moi");
    elle = await creerUtilisatrice("pref-elle");
  });
  afterAll(async () => {
    if (moi) await admin.auth.admin.deleteUser(moi.id);
    if (elle) await admin.auth.admin.deleteUser(elle.id);
  });

  it("elle pose et modifie SA préférence", async () => {
    const { error } = await moi.client.from("preference_socle").insert({ utilisatrice_id: moi.id, heure: 7 });
    expect(error, "elle n'a pas pu poser sa propre heure").toBeNull();
    const { error: e2 } = await moi.client.from("preference_socle").update({ heure: 21 }).eq("utilisatrice_id", moi.id);
    expect(e2).toBeNull();
    const { data } = await admin.from("preference_socle").select("heure").eq("utilisatrice_id", moi.id).single();
    expect(data?.heure).toBe(21);
  });

  it("[LE CŒUR] elle ne pose PAS la préférence de quelqu'un d'autre", async () => {
    // ⚠️ Mutation-cible : retirer le `with check` de la policy d'insertion. Rien d'autre dans le
    // dépôt n'empêcherait alors une session de régler l'heure de notification d'une inconnue —
    // pas une fuite de données, mais une prise de contrôle sur son téléphone à 3 h du matin.
    const { error } = await moi.client.from("preference_socle").insert({ utilisatrice_id: elle.id, heure: 3 });
    expect(error, "une session a écrit la préférence d'une autre").not.toBeNull();
  });

  it("[LE CŒUR] elle ne RÉATTRIBUE pas sa préférence par update — DEUX gardes s'y opposent", async () => {
    // ⚠️ CE TEST A ÉTÉ RÉÉCRIT APRÈS LA CAMPAGNE DE MUTATION, et ce qu'il a appris vaut d'être écrit.
    //
    // Il s'appelait « le WITH CHECK de l'UPDATE » et prétendait le prouver. Le mutant S7 — remplacer
    // ce `with check` par `true` — a SURVÉCU. Trois sondes plus tard, le mécanisme réel est identifié :
    //
    //   • la porte que je croyais unique : `with check (auth.uid() = utilisatrice_id)` sur l'UPDATE ;
    //   • **celle qui porte réellement le refus aujourd'hui** : la policy de SELECT, appliquée à la
    //     NOUVELLE ligne. La ligne relue après écriture appartiendrait à quelqu'un d'autre, donc elle
    //     ne la voit pas, donc Postgres refuse — `42501, new row violates row-level security policy`.
    //
    // Les deux se couvrent l'une l'autre : c'est LE PIÈGE DES DÉFENSES REDONDANTES du dépôt, et c'est
    // pour ça que le mutant survit. Relâcher les DEUX (vérifié à la sonde) laisse la ligne changer de
    // propriétaire.
    //
    // ⚠️ **On garde le `with check` malgré sa redondance apparente**, et ce n'est pas de la ceinture-
    // bretelles décorative : sans lui, la propriété reposerait sur le fait que le client relit la
    // ligne après écriture — un comportement de BIBLIOTHÈQUE, pas une garantie de la base. Le jour où
    // un appelant écrit sans relire, la seule garde restante disparaîtrait sans qu'un test bouge.
    await admin.from("preference_socle").upsert({ utilisatrice_id: moi.id, heure: 9 }, { onConflict: "utilisatrice_id" });
    const { error } = await moi.client
      .from("preference_socle")
      .update({ utilisatrice_id: elle.id })
      .eq("utilisatrice_id", moi.id);
    expect(error?.code, "la base a laissé passer la réattribution").toBe("42501");

    const { data: chezElle } = await admin
      .from("preference_socle")
      .select("utilisatrice_id")
      .eq("utilisatrice_id", elle.id);
    expect(chezElle ?? [], "la préférence a changé de propriétaire").toHaveLength(0);
    const { data: chezMoi } = await admin
      .from("preference_socle")
      .select("heure")
      .eq("utilisatrice_id", moi.id);
    expect(chezMoi ?? [], "et elle a perdu la sienne au passage").toHaveLength(1);
  });

  it("elle ne LIT pas la préférence d'une autre", async () => {
    await admin.from("preference_socle").upsert({ utilisatrice_id: elle.id, heure: 6 }, { onConflict: "utilisatrice_id" });
    const { data } = await moi.client.from("preference_socle").select("*").eq("utilisatrice_id", elle.id);
    expect(data ?? []).toHaveLength(0);
  });

  it.each([[-1], [24], [99]])("une heure hors du jour civil est refusée : %i", async (heure) => {
    const { error } = await admin
      .from("preference_socle")
      .upsert({ utilisatrice_id: moi.id, heure }, { onConflict: "utilisatrice_id" });
    expect(error, `heure ${heure} acceptée`).not.toBeNull();
  });

  it("[CONTRÔLE POSITIF] 0 et 23 sont acceptées — la borne n'est pas un refus général", async () => {
    for (const heure of [0, 23]) {
      const { error } = await admin
        .from("preference_socle")
        .upsert({ utilisatrice_id: moi.id, heure }, { onConflict: "utilisatrice_id" });
      expect(error, `heure ${heure} refusée`).toBeNull();
    }
  });
});

describe("[6.2/D6] `abonnement_poussee` : l'abonnement EST le consentement", () => {
  let moi: Utilisatrice;
  let elle: Utilisatrice;

  beforeAll(async () => {
    moi = await creerUtilisatrice("push-moi");
    elle = await creerUtilisatrice("push-elle");
  });
  afterAll(async () => {
    if (moi) await admin.auth.admin.deleteUser(moi.id);
    if (elle) await admin.auth.admin.deleteUser(elle.id);
  });

  it("elle abonne SON appareil, puis le retire", async () => {
    const endpoint = endpointDe("moi-ok");
    const { error } = await moi.client
      .from("abonnement_poussee")
      .insert({ utilisatrice_id: moi.id, endpoint, cle_p256dh: P256DH, cle_auth: AUTH });
    expect(error, "elle n'a pas pu abonner son propre appareil").toBeNull();

    const { error: e2 } = await moi.client.from("abonnement_poussee").delete().eq("endpoint", endpoint);
    expect(e2).toBeNull();
    const { data } = await admin.from("abonnement_poussee").select("id").eq("endpoint", endpoint);
    expect(data ?? [], "se désabonner n'a rien supprimé — D6 ment").toHaveLength(0);
  });

  it("[LE CŒUR] elle n'abonne pas l'appareil de quelqu'un d'autre", async () => {
    const { error } = await moi.client
      .from("abonnement_poussee")
      .insert({ utilisatrice_id: elle.id, endpoint: endpointDe("vol"), cle_p256dh: P256DH, cle_auth: AUTH });
    expect(error, "une session a abonné une autre personne").not.toBeNull();
  });

  it("[LE CŒUR] il n'existe AUCUNE policy d'UPDATE — un abonnement ne s'amende pas", async () => {
    // ⚠️ Sans cette absence, une ligne garderait son `id` en changeant d'endpoint, et l'index unique
    // ne dirait plus ce qu'il prétend dire : « cet endpoint appartient à cette personne ».
    const endpoint = endpointDe("immuable");
    await admin
      .from("abonnement_poussee")
      .insert({ utilisatrice_id: moi.id, endpoint, cle_p256dh: P256DH, cle_auth: AUTH });
    const { error } = await moi.client
      .from("abonnement_poussee")
      .update({ endpoint: endpointDe("detourne") })
      .eq("endpoint", endpoint);
    const { data } = await admin.from("abonnement_poussee").select("endpoint").eq("endpoint", endpoint);
    expect(error !== null || (data ?? []).length === 1, "l'abonnement a été amendé").toBe(true);
  });

  it.each([
    ["un hôte quelconque", "https://collecte.exemple.fr/anam"],
    ["un hôte qui imite", "https://web.push.apple.com.exemple.fr/anam"],
    ["du texte en clair", "https://web.push.apple.com/Sophie va mal"],
    ["sans TLS", "http://web.push.apple.com/anam"],
    ["un hôte interne", "https://10.0.0.1/anam"],
  ])("[LE CŒUR] endpoint refusé — %s", async (_cas, endpoint) => {
    // ⚠️ Mutation-cible : retirer la contrainte de forme. Trois colonnes `text` écrites par
    // `authenticated` sans forme fermée sont trois endroits où de l'art. 9 finirait par se ranger —
    // et l'allowlist d'hôtes est en plus ce qui empêche une session de faire POSTer notre serveur
    // vers l'URL de son choix, l'en-tête VAPID en prime.
    const { error } = await admin
      .from("abonnement_poussee")
      .insert({ utilisatrice_id: moi.id, endpoint, cle_p256dh: P256DH, cle_auth: AUTH });
    expect(error, `endpoint accepté : ${endpoint}`).not.toBeNull();
  });

  it("[CONTRÔLE POSITIF] les trois hôtes réels passent", async () => {
    for (const [i, hote] of [
      "https://web.push.apple.com/",
      "https://fcm.googleapis.com/fcm/send/",
      "https://updates.push.services.mozilla.com/wpush/v2/",
    ].entries()) {
      const { error } = await admin.from("abonnement_poussee").insert({
        utilisatrice_id: moi.id,
        endpoint: `${hote}anam-hote-${i}-${t}`,
        cle_p256dh: P256DH,
        cle_auth: AUTH,
      });
      expect(error, `hôte réel refusé : ${hote}`).toBeNull();
    }
  });

  it.each([
    [0, "p256dh trop court", { cle_p256dh: "abc", cle_auth: AUTH }],
    [1, "p256dh hors base64url", { cle_p256dh: `${"B".repeat(86)} `, cle_auth: AUTH }],
    [2, "auth avec du texte", { cle_p256dh: P256DH, cle_auth: "elle ne va pas bien" }],
    [3, "auth démesurée", { cle_p256dh: P256DH, cle_auth: "A".repeat(200) }],
  ])("les clés sont du base64url borné — %s#%s refusé", async (i, _cas, cles) => {
    // ⚠️ CE TEST ÉTAIT VACUEUX, et c'est un mutant qui l'a dit (S9). Le suffixe d'endpoint était
    // fabriqué à partir du LIBELLÉ du cas — « p256dh trop court » — donc il contenait des ESPACES,
    // que la contrainte d'endpoint refuse. Les quatre insertions échouaient bien, mais toutes pour la
    // mauvaise raison : la contrainte de clés n'était jamais atteinte, et la relâcher ne faisait
    // rougir personne.
    //
    // L'endpoint est désormais indexé par un entier. La leçon est générale : un test qui asserte
    // « ça échoue » doit prouver qu'il échoue POUR LA RAISON QU'IL VISE.
    const endpoint = endpointDe(`cles-${i}`);
    const { error } = await admin
      .from("abonnement_poussee")
      .insert({ utilisatrice_id: moi.id, endpoint, cle_p256dh: P256DH, cle_auth: AUTH });
    expect(error, "l'endpoint témoin est refusé — le cas ne prouverait rien").toBeNull();
    await admin.from("abonnement_poussee").delete().eq("endpoint", endpoint);

    const { error: e2 } = await admin
      .from("abonnement_poussee")
      .insert({ utilisatrice_id: moi.id, endpoint, ...cles });
    expect(e2, `clés acceptées : ${JSON.stringify(cles)}`).not.toBeNull();
  });

  it("[FR-067] l'abonnement et la préférence partent avec le compte", async () => {
    const jetable = { id: await creerCompte("cascade") };
    await rendreDue(jetable.id, "cascade");
    await admin.auth.admin.deleteUser(jetable.id);
    const { data: a } = await admin.from("abonnement_poussee").select("id").eq("utilisatrice_id", jetable.id);
    const { data: p } = await admin.from("preference_socle").select("heure").eq("utilisatrice_id", jetable.id);
    expect(a ?? []).toHaveLength(0);
    expect(p ?? []).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 2. LA SÉLECTION
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.2/AC2] `socle_quotidien_du` — qui est due, à cette heure-ci", () => {
  // Aucune session ici : la sélection est interrogée sous le client ADMIN (c'est l'ordonnanceur qui
  // l'appelle, jamais une session — la RPC est d'ailleurs révoquée à `authenticated`, cf. plus bas).
  const jetables: string[] = [];
  const jeter = async (suffixe: string) => {
    const id = await creerCompte(suffixe);
    jetables.push(id);
    return { id };
  };
  afterAll(async () => {
    for (const id of jetables) await admin.auth.admin.deleteUser(id);
  });

  it("[LE CŒUR] une personne SANS ABONNEMENT PREMIUM est due — le socle est le tronc gratuit", async () => {
    // ⚠️ C'est l'assertion qui distingue `personne_joignable` d'`eligible_au_periodique`, et le
    // mutant est d'une banalité totale : réutiliser `eligible_au_periodique` parce qu'elle existe
    // déjà et qu'elle « fait la même chose ». Le socle deviendrait payant (régression de la 3.3,
    // FR-088) et rien d'autre dans le dépôt ne le dirait — la fonction s'appelle « éligible au
    // périodique », pas « éligible si elle paie ».
    const u = await jeter("gratuite");
    await rendreDue(u.id, "gratuite");
    const { data: ab } = await admin.from("abonnement").select("etat").eq("utilisatrice_id", u.id);
    expect((ab ?? []).some((a) => a.etat === "actif"), "la mise en scène lui a donné du premium").toBe(false);
    expect(await dues()).toContain(u.id);
  });

  it("une heure FUTURE ne la sélectionne pas", async () => {
    const u = await jeter("heure-future");
    await rendreDue(u.id, "heure-future", (heureParis() + 5) % 24);
    expect(await dues()).not.toContain(u.id);
  });

  it("[LE CŒUR] une heure PASSÉE ne la sélectionne pas non plus", async () => {
    // ⚠️ CE TEST MANQUAIT, et c'est un mutant qui l'a dit (S14). Avec seulement une heure FUTURE,
    // remplacer `heure = heure_courante` par `heure <=` ne faisait rougir personne — et la
    // conséquence est grosse : à 20 h, TOUTES les personnes ayant choisi une heure antérieure
    // seraient poussées d'un coup, ensemble, à l'heure du soir. C'est-à-dire exactement l'inverse
    // d'« à l'heure que tu choisis ».
    //
    // (Le lot de 20 fait le reste des dégâts : les autres perdent leur journée, sans rattrapage.)
    const u = await jeter("heure-passee");
    await rendreDue(u.id, "heure-passee", (heureParis() + 23) % 24);
    expect(await dues()).not.toContain(u.id);
  });

  it("sans aucun appareil abonné, elle n'occupe pas une place du lot", async () => {
    const u = await jeter("sans-appareil");
    await consentir(u.id);
    await admin.from("preference_socle").upsert({ utilisatrice_id: u.id, heure: heureParis() }, { onConflict: "utilisatrice_id" });
    expect(await dues()).not.toContain(u.id);
  });

  it("[LE CŒUR] déjà servie aujourd'hui — au plus une fois par jour civil (AC2)", async () => {
    const u = await jeter("deja-servie");
    await rendreDue(u.id, "deja-servie");
    expect(await dues(), "la mise en scène ne la rendait pas due").toContain(u.id);

    const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
    const { error } = await admin
      .from("notification_envoyee")
      .insert({ utilisatrice_id: u.id, motif: "socle_quotidien", cle: jour });
    expect(error, "le motif `socle_quotidien` n'entre pas dans le CHECK").toBeNull();
    expect(await dues()).not.toContain(u.id);
  });

  it("une désabonnée du canal ne consomme pas une place (art. 21 — le traitement, pas le transport)", async () => {
    const u = await jeter("desabonnee");
    await rendreDue(u.id, "desabonnee");
    await admin
      .from("preference_courriel")
      .upsert({ utilisatrice_id: u.id, refuse_le: new Date().toISOString() }, { onConflict: "utilisatrice_id" });
    expect(await dues()).not.toContain(u.id);
  });

  it("[AD-17] un épisode de détresse EN COURS la retire", async () => {
    const u = await jeter("detresse");
    await rendreDue(u.id, "detresse");
    expect(await dues(), "la mise en scène ne la rendait pas due").toContain(u.id);
    const { error } = await admin.from("episode_detresse").insert({ utilisatrice_id: u.id, niveau_max: 2 });
    expect(error, "l'épisode n'a pas pu être créé — le test ne prouverait rien").toBeNull();
    expect(await dues()).not.toContain(u.id);
  });

  it("[AD-17] la fenêtre de 72 h CHAUDE la retire encore, épisode refermé", async () => {
    // La moitié qu'on oublie : `fin` posée ne suffit pas, c'est `fenetre_expire_at` qui décide.
    const u = await jeter("fenetre");
    await rendreDue(u.id, "fenetre");
    await admin.from("episode_detresse").insert({ utilisatrice_id: u.id, niveau_max: 2 });
    const { error } = await admin
      .from("episode_detresse")
      .update({ fin: new Date().toISOString(), fenetre_expire_at: new Date(Date.now() + 72 * 3600_000).toISOString() })
      .eq("utilisatrice_id", u.id);
    expect(error, "l'épisode n'a pas pu être refermé — le test ne prouverait rien").toBeNull();
    expect(await dues()).not.toContain(u.id);
  });

  it("consentement art. 9 révoqué — elle sort", async () => {
    const u = await jeter("revoquee");
    await rendreDue(u.id, "revoquee");
    await admin.from("consentement").update({ revoked_at: new Date().toISOString() }).eq("utilisatrice_id", u.id);
    expect(await dues()).not.toContain(u.id);
  });

  it("barrière de minorité — elle sort", async () => {
    const u = await jeter("barriere");
    await rendreDue(u.id, "barriere");
    await admin.from("utilisatrice").update({ barriere_minorite_le: new Date().toISOString() }).eq("id", u.id);
    expect(await dues()).not.toContain(u.id);
  });

  it("[LE CŒUR] l'heure n'est PAS un paramètre — l'applicatif ne dit pas à la base quelle heure il est", async () => {
    // ⚠️ Mutation-cible : `socle_quotidien_du(p_heure, p_limite)`. La garde « à l'heure choisie » ne
    // garderait plus que la sincérité de l'appelant, et un ordonnanceur qui se trompe de fuseau
    // pousserait à trois heures du matin sans qu'aucune clause SQL ne l'arrête. C'est la leçon de
    // 0046 (`jour_paris`), transposée à l'heure.
    const { error } = await admin.rpc("socle_quotidien_du", { p_heure: 8, p_limite: 10 });
    expect(error, "la fonction accepte qu'on lui dise l'heure").not.toBeNull();
  });

  it("[MÉTA] la sélection n'est pas vide par accident", async () => {
    const u = await jeter("temoin");
    await rendreDue(u.id, "temoin");
    expect(await dues(), "aucune des exclusions ci-dessus ne prouve rien si personne n'est jamais due").toContain(u.id);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 3. LA RÉÉCRITURE D'`eligible_au_periodique` — les cinq refus, un par un
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.2/§1] `eligible_au_periodique` n'a rien perdu en déléguant", () => {
  const jetables: string[] = [];
  afterAll(async () => {
    for (const id of jetables) await admin.auth.admin.deleteUser(id);
  });

  const eligible = async (id: string) => {
    const { data, error } = await admin.rpc("eligible_au_periodique", { p_utilisatrice: id });
    if (error) throw new Error(`eligible_au_periodique: ${error.message}`);
    return data === true;
  };
  const joignable = async (id: string) => {
    const { data, error } = await admin.rpc("personne_joignable", { p_utilisatrice: id });
    if (error) throw new Error(`personne_joignable: ${error.message}`);
    return data === true;
  };

  /** Une personne à qui il ne manque RIEN — le seul point de départ qui rende les refus lisibles. */
  async function parfaite(suffixe: string): Promise<string> {
    const id = await creerCompte(`elig-${suffixe}`);
    jetables.push(id);
    await consentir(id);
    const { error } = await admin
      .from("abonnement")
      .insert({ utilisatrice_id: id, etat: "actif", source_maj_le: new Date().toISOString() });
    if (error) throw new Error(`abonnement: ${error.message}`);
    return id;
  }

  it("[CONTRÔLE POSITIF] elle est éligible ET joignable — sans quoi les cinq refus ci-dessous ne prouvent rien", async () => {
    const id = await parfaite("temoin");
    expect(await eligible(id)).toBe(true);
    expect(await joignable(id)).toBe(true);
  });

  it("1/5 — sans consentement art. 9 vivant", async () => {
    const id = await parfaite("consentement");
    await admin.from("consentement").update({ revoked_at: new Date().toISOString() }).eq("utilisatrice_id", id);
    expect(await eligible(id)).toBe(false);
    expect(await joignable(id)).toBe(false);
  });

  it("2/5 — barrière de minorité posée après coup", async () => {
    const id = await parfaite("barriere");
    await admin.from("utilisatrice").update({ barriere_minorite_le: new Date().toISOString() }).eq("id", id);
    expect(await eligible(id)).toBe(false);
    expect(await joignable(id)).toBe(false);
  });

  it("3/5 — minorité persistante", async () => {
    const id = await parfaite("mineure");
    // Revue Epics 1-4 (#11) : la minorité déclarée passe par `declarer_minorite`, qui pose AUSSI
    // l'échéance de suppression — sans elle, le compte n'était atteint par aucun chemin d'effacement.
    // Le trigger de 0070 refuse désormais la moitié d'état que cette fixture écrivait.
    await admin.rpc("declarer_minorite", {
      cible: id,
      echeance: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    });
    expect(await eligible(id)).toBe(false);
    expect(await joignable(id)).toBe(false);
  });

  it("4/5 — épisode de détresse (AD-17)", async () => {
    const id = await parfaite("detresse");
    await admin.from("episode_detresse").insert({ utilisatrice_id: id, niveau_max: 2 });
    expect(await eligible(id)).toBe(false);
    expect(await joignable(id)).toBe(false);
  });

  it("[LE CŒUR] 5/5 — sans premium : `eligible_au_periodique` refuse, `personne_joignable` ACCEPTE", async () => {
    // La seule des cinq où les deux fonctions divergent. C'est exactement la ligne de partage que
    // l'extraction existe pour tracer : le rappel d'échéance et la synthèse sont premium (FR-081),
    // le socle quotidien ne l'est pas (FR-088).
    const id = await parfaite("sans-premium");
    await admin.from("abonnement").delete().eq("utilisatrice_id", id);
    expect(await eligible(id)).toBe(false);
    expect(await joignable(id)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 4. LA FAMILLE, LE PLAFOND, ET LES DROITS
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.2/D7] le socle est une AUTRE famille — et `reserver_notification` n'a pas bougé", () => {
  const familleDe = async (motif: string) => {
    const { data, error } = await admin.rpc("famille_motif", { p_motif: motif });
    if (error) throw new Error(`famille_motif: ${error.message}`);
    return data as string | null;
  };

  it("les trois motifs sont classés, et l'inconnu reste NULL", async () => {
    expect(await familleDe("socle_quotidien")).toBe("socle");
    expect(await familleDe("synthese_prete")).toBe("anam");
    expect(await familleDe("echeance_intention")).toBe("anam");
    // ⚠️ Fail-closed conservé : `reserver_notification` LÈVE sur une famille nulle. Le jour où
    // quelqu'un ajoutera une valeur au CHECK sans la classer, l'envoi cassera bruyamment.
    expect(await familleDe("reengagement")).toBeNull();
  });

  it("[LE CŒUR] une notification d'Anam ne consomme PAS le plafond du socle", async () => {
    // C'était toute la raison du passage « par motif » → « par famille » en 4.10, et c'est ce que
    // l'arrivée d'une troisième valeur pouvait casser sans bruit : si `socle_quotidien` était classé
    // `anam`, une synthèse annoncée hier supprimerait la manifestation quotidienne pendant 72 heures.
    const u = { id: await creerCompte("familles") };
    try {
      await consentir(u.id);
      const reserver = async (motif: string, cle: string, plafond: number) => {
        const { data, error } = await admin.rpc("reserver_notification", {
          p_utilisatrice: u.id,
          p_motif: motif,
          p_cle: cle,
          p_plafond_heures: plafond,
        });
        if (error) throw new Error(`reserver_notification(${motif}): ${error.message}`);
        return data === true;
      };
      expect(await reserver("synthese_prete", `s-${t}`, 72)).toBe(true);
      expect(await reserver("socle_quotidien", `2026-08-15-${t}`, 20)).toBe(true);
      // …et le plafond de la famille `socle` mord bien à l'intérieur d'elle-même.
      expect(await reserver("socle_quotidien", `2026-08-16-${t}`, 20)).toBe(false);
    } finally {
      await admin.auth.admin.deleteUser(u.id);
    }
  });
});

describe("[6.2] aucune session ne peut appeler les RPC de l'ordonnanceur", () => {
  let u: Utilisatrice;
  beforeAll(async () => {
    u = await creerUtilisatrice("droits");
  });
  afterAll(async () => {
    if (u) await admin.auth.admin.deleteUser(u.id);
  });

  it.each([
    ["socle_quotidien_du", { p_limite: 5 }],
    ["endpoints_poussee", { p_utilisatrice: "00000000-0000-4000-8000-000000000000" }],
    ["oublier_endpoint_poussee", { p_endpoint: "https://web.push.apple.com/x" }],
    ["personne_joignable", { p_utilisatrice: "00000000-0000-4000-8000-000000000000" }],
  ])("%s est hors de portée d'`authenticated`", async (nom, args) => {
    const { error } = await u.client.rpc(nom, args);
    expect(error?.message ?? "", `${nom} est appelable depuis une session`).toMatch(/permission denied|not find/i);
  });
});

describe("[6.2] `abonner_poussee` — deux comptes sur le même navigateur", () => {
  it("[LE CŒUR] le second abonnement DÉLOGE le premier, il n'échoue pas en silence", async () => {
    // ⚠️ CE TEST EST NÉ DE LA CAMPAGNE DE MUTATION : rien ne couvrait le `delete` préalable de la
    // fonction, et le supprimer ne faisait rougir personne.
    //
    // Le scénario est pourtant banal — deux comptes sur un même téléphone. Le navigateur rend LE MÊME
    // endpoint aux deux (il appartient à l'appareil, pas au compte) ; sans le `delete`, l'index unique
    // refuse l'insertion et la SECONDE personne n'est jamais notifiée. Silencieusement, puisque son
    // navigateur, lui, s'est bien abonné. Pire : les poussées continueraient d'arriver à la PREMIÈRE.
    const a = await creerUtilisatrice("navig-a");
    const b = await creerUtilisatrice("navig-b");
    try {
      const endpoint = endpointDe("navigateur-partage");
      const abonner = (u: Utilisatrice) =>
        u.client.rpc("abonner_poussee", { p_endpoint: endpoint, p_p256dh: P256DH, p_auth: AUTH });

      expect((await abonner(a)).error, "le premier abonnement a échoué").toBeNull();
      expect((await abonner(b)).error, "le second abonnement a échoué — la personne ne recevra rien").toBeNull();

      const { data } = await admin.from("abonnement_poussee").select("utilisatrice_id").eq("endpoint", endpoint);
      expect(data ?? [], "l'endpoint s'est dédoublé").toHaveLength(1);
      expect(data![0].utilisatrice_id, "l'appareil est resté à la première personne").toBe(b.id);

      // Et la préférence naît avec l'abonnement — sans elle, la sélection ne trouverait jamais
      // personne, et tout l'abonnement n'aurait servi à rien.
      const { data: pref } = await admin.from("preference_socle").select("heure").eq("utilisatrice_id", b.id);
      expect(pref ?? [], "la préférence n'est pas née avec l'abonnement").toHaveLength(1);
      expect(pref![0].heure).toBe(8);
    } finally {
      await admin.auth.admin.deleteUser(a.id);
      await admin.auth.admin.deleteUser(b.id);
    }
  });

  it("[LE CŒUR] elle n'abonne QUE elle-même — il n'y a aucun paramètre à forger", async () => {
    // La fonction lit `auth.uid()` et n'a pas de `p_utilisatrice`. C'est ce qui permet de la donner à
    // `authenticated` sans rouvrir ce que les policies ferment : la garde n'est pas « la RPC
    // vérifie », elle est « la RPC n'a pas de quoi se tromper ».
    const u = await creerUtilisatrice("navig-seule");
    try {
      const endpoint = endpointDe("moi-seule");
      await u.client.rpc("abonner_poussee", { p_endpoint: endpoint, p_p256dh: P256DH, p_auth: AUTH });
      const { data } = await admin.from("abonnement_poussee").select("utilisatrice_id").eq("endpoint", endpoint);
      expect(data![0].utilisatrice_id).toBe(u.id);

      // Et les contraintes de FORME s'appliquent à travers elle : `security definer` ne les contourne
      // pas, et c'est le point qu'on vérifierait en dernier en relisant.
      const { error } = await u.client.rpc("abonner_poussee", {
        p_endpoint: "https://collecte.exemple.fr/x",
        p_p256dh: P256DH,
        p_auth: AUTH,
      });
      expect(error, "la RPC contourne l'allowlist d'hôtes").not.toBeNull();
    } finally {
      await admin.auth.admin.deleteUser(u.id);
    }
  });
});

describe("[6.2] `oublier_endpoint_poussee` — un endpoint mort ne s'accumule pas", () => {
  it("supprime, et dit ce qu'elle a fait", async () => {
    const u = { id: await creerCompte("oubli") };
    try {
      const endpoint = endpointDe("mort");
      await admin
        .from("abonnement_poussee")
        .insert({ utilisatrice_id: u.id, endpoint, cle_p256dh: P256DH, cle_auth: AUTH });
      const { data: oui } = await admin.rpc("oublier_endpoint_poussee", { p_endpoint: endpoint });
      expect(oui, "l'endpoint mort n'a pas été supprimé").toBe(true);
      const { data: reste } = await admin.from("abonnement_poussee").select("id").eq("endpoint", endpoint);
      expect(reste ?? []).toHaveLength(0);
      // Deuxième passage : rien à supprimer, et surtout pas d'exception — le job la rappelle en boucle.
      const { data: non } = await admin.rpc("oublier_endpoint_poussee", { p_endpoint: endpoint });
      expect(non).toBe(false);
    } finally {
      await admin.auth.admin.deleteUser(u.id);
    }
  });
});
