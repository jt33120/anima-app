import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/desabonnement/route";
import { PLAFOND_NOTIFICATION_HEURES, RETENTION_NOTIFICATION_JOURS } from "@/lib/domain/synthese";

/**
 * REVUE 4.9 (T5-2 / T5-3) — LE DÉSABONNEMENT, contre le VRAI Postgres et par la VRAIE route.
 *
 * Le courriel promettait « Pour ne plus recevoir ces messages, réponds à ce courriel ». Trois vides
 * derrière cette phrase, vérifiés un par un : aucune boîte entrante, aucun mécanisme d'opt-out, aucun
 * en-tête `List-Unsubscribe`. Ses seules sorties réelles étaient de résilier son abonnement ou de révoquer
 * son consentement art. 9 — renoncer au produit pour exercer un droit d'opposition.
 *
 * Et le retour de flamme, qui est le pire des deux : celle qui répond n'écrit pas « stop », elle écrit
 * POURQUOI. Ce texte libre est de l'art. 9, et il arrive dans une boîte ordinaire — hors RLS, hors
 * write-gate, hors ZDR — pour y rester indéfiniment.
 *
 * Ce fichier prouve la chose la plus importante du lot : que le refus ARRÊTE RÉELLEMENT l'envoi. Il ne
 * suffit pas qu'une colonne existe ; il faut qu'elle soit lue à l'endroit où l'envoi se décide.
 */

const url = process.env.SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const t = Date.now();

const elle = { email: `desab-${t}@exemple.fr`, motDePasse: "desab-123!", id: "" };
let jeton = "";

async function rpc(nom: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(nom, args);
  if (error) throw new Error(`${nom}: ${error.message}`);
  return data;
}

/**
 * Une réservation neuve. La table est vidée d'abord, et ce n'est PAS de la commodité : le plafond de 72 h
 * est vrai, donc une réservation réussie en bloque une autre pendant trois jours. Sans ce nettoyage, le
 * contrôle positif d'en dessous ferait échouer les cas suivants pour la mauvaise raison — et surtout, il
 * ferait passer en vert un `reserver_notification` qui aurait perdu sa garde de refus.
 */
async function reserver(cle: string) {
  await admin.from("notification_envoyee").delete().eq("utilisatrice_id", elle.id);
  return rpc("reserver_notification", {
    p_utilisatrice: elle.id,
    p_motif: "synthese_prete",
    p_cle: cle,
    p_plafond_heures: PLAFOND_NOTIFICATION_HEURES,
  });
}

/** Toute écriture de fixture est VÉRIFIÉE : une insertion refusée en silence fait mesurer le vide. */
async function ecrire(table: string, lignes: Record<string, unknown>[]) {
  const { error } = await admin.from(table).insert(lignes);
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
}

beforeAll(async () => {
  if (!url || !secret) throw new Error("Supabase local requis.");
  const { data, error } = await admin.auth.admin.createUser({
    email: elle.email,
    password: elle.motDePasse,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  elle.id = data.user!.id;
});

afterAll(async () => {
  if (elle.id) await admin.auth.admin.deleteUser(elle.id); // la cascade emporte le reste (FR-067)
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("le jeton — opaque, propre au canal, créé au premier envoi", () => {
  it("[LE CŒUR] il naît à la demande, et il est STABLE", async () => {
    // Stable, parce qu'un jeton qui changerait à chaque envoi ferait qu'un courriel d'il y a trois
    // semaines ne désabonne plus. Or c'est précisément le vieux courriel qu'on retrouve quand on en a
    // assez d'en recevoir.
    const { count: avant } = await admin
      .from("preference_courriel")
      .select("*", { count: "exact", head: true })
      .eq("utilisatrice_id", elle.id);
    expect(avant, "aucune ligne avant le premier envoi — création paresseuse").toBe(0);

    jeton = (await rpc("jeton_courriel", { p_utilisatrice: elle.id })) as string;
    expect(jeton).toMatch(/^[0-9a-f-]{36}$/);
    expect(await rpc("jeton_courriel", { p_utilisatrice: elle.id }), "idempotent").toBe(jeton);
  });

  it("il ne recoupe RIEN — ce n'est pas l'identifiant de l'utilisatrice", async () => {
    // Ce jeton traverse Resend, un serveur de messagerie, et les journaux des deux. Un uuid
    // d'utilisatrice qui voyage dans une URL est un identifiant pseudonyme réutilisable, recoupable avec
    // tout ce qui porte le même uuid ailleurs. Mutation-cible : `default` = l'identifiant lui-même.
    expect(jeton).not.toBe(elle.id);
  });
});

describe("[LE CŒUR] le refus ARRÊTE l'envoi, là où l'envoi se décide", () => {
  it("avant le refus, la réservation est accordée", async () => {
    // Le contrôle positif. Sans lui, tout ce qui suit serait satisfait par une réservation qui refuse
    // TOUJOURS — un canal mort, tout aussi cassé, et invisible.
    expect(await reserver(`cle-avant-${t}`)).toBe(true);
  });

  it("[LE CŒUR] après le refus, elle est refusée — ET rien n'est consommé", async () => {
    // La garde vit dans `reserver_notification`, le point de passage unique du canal, pas dans le job qui
    // pourrait l'oublier. Et elle est AVANT l'insertion : refuser en insérant brûlerait la clé
    // d'idempotence de la période, si bien que le jour où elle se réabonne, la synthèse de cette
    // période-là ne lui serait jamais annoncée.
    // Mutation-cible : déplacer le `if exists` après l'insertion, ou le retirer.
    expect(await rpc("regler_courriels_par_jeton", { p_jeton: jeton, p_refuse: true })).toBe(true);

    const cle = `cle-pendant-${t}`;
    expect(await reserver(cle), "aucun envoi").toBe(false);

    const { count } = await admin
      .from("notification_envoyee")
      .select("*", { count: "exact", head: true })
      .eq("utilisatrice_id", elle.id)
      .eq("cle", cle);
    expect(count, "et aucune trace : son opposition ne consomme rien").toBe(0);
  });

  it("le refus est idempotent, et sa DATE ne bouge pas", async () => {
    // La date est la preuve de la prise en compte de son opposition (art. 21). Un second clic ne doit pas
    // la repousser : ce serait effacer le moment où elle a demandé.
    const { data: avant } = await admin
      .from("preference_courriel")
      .select("refuse_le")
      .eq("utilisatrice_id", elle.id)
      .single();

    expect(await rpc("regler_courriels_par_jeton", { p_jeton: jeton, p_refuse: true })).toBe(true);

    const { data: apres } = await admin
      .from("preference_courriel")
      .select("refuse_le")
      .eq("utilisatrice_id", elle.id)
      .single();
    expect(apres!.refuse_le).toBe(avant!.refuse_le);
  });

  it("[LE CŒUR] elle peut REVENIR, avec le même jeton", async () => {
    // Sans le retour, un clic malheureux — ou un scanner de sécurité qui suit le lien — la priverait
    // définitivement de l'annonce, sans qu'elle sache où le rétablir ni à qui le demander.
    expect(await rpc("regler_courriels_par_jeton", { p_jeton: jeton, p_refuse: false })).toBe(true);
    expect(await reserver(`cle-apres-${t}`), "le canal se rouvre").toBe(true);
  });

  it("un jeton inconnu ne fait rien et se dit `false` — sans distinguer les cas", async () => {
    // Distinguer « n'a jamais existé » de « a été effacé » ferait de ce lien un oracle d'existence de
    // compte, interrogeable sans aucune authentification.
    expect(
      await rpc("regler_courriels_par_jeton", {
        p_jeton: "00000000-0000-4000-8000-000000000000",
        p_refuse: true,
      }),
    ).toBe(false);
  });
});

describe("la route un-clic (RFC 8058)", () => {
  it("[LE CŒUR] un POST désabonne réellement", async () => {
    // C'est la cible de l'en-tête `List-Unsubscribe` : le bouton « Se désabonner » que Gmail affiche à
    // côté de l'expéditeur. Sans lui, le geste offert à la place est « signaler comme spam ».
    const reponse = await POST(
      new NextRequest(`http://localhost/api/desabonnement?j=${jeton}`, { method: "POST" }),
    );
    expect(reponse.status).toBe(200);

    const { data } = await admin
      .from("preference_courriel")
      .select("refuse_le")
      .eq("utilisatrice_id", elle.id)
      .single();
    expect(data!.refuse_le, "le refus est posé en base, pas seulement affiché").not.toBeNull();
    expect(await reserver(`cle-route-${t}`), "et l'envoi s'arrête vraiment").toBe(false);
  });

  it("un jeton absent ou mal formé répond PAREIL — aucun oracle", async () => {
    // Une réponse qui distinguerait les deux cas ferait de cette route un test d'existence de compte,
    // appelable par n'importe qui, sans authentification et sans trace.
    for (const cible of [
      "http://localhost/api/desabonnement",
      "http://localhost/api/desabonnement?j=",
      "http://localhost/api/desabonnement?j=pas-un-uuid",
      "http://localhost/api/desabonnement?j=00000000-0000-4000-8000-000000000000",
    ]) {
      const r = await POST(new NextRequest(cible, { method: "POST" }));
      expect(r.status, cible).toBe(200);
      expect(await r.text(), cible).toBe("OK");
    }
  });

  it("aucun GET n'est exporté — un scanner de lien ne peut pas désabonner à sa place", async () => {
    // Les antivirus d'entreprise et les prévisualisateurs suivent les GET des courriels. Un
    // désabonnement sur GET serait déclenché sans qu'elle ait rien fait ni rien su.
    const module = await import("@/app/api/desabonnement/route");
    expect(Object.keys(module).sort()).toEqual(["POST"]);
  });
});

describe("[T5-3] la purge de la trace", () => {
  it("[LE CŒUR] au-delà de la rétention, la ligne s'en va ; en deçà, elle reste", async () => {
    // `notification_envoyee` ne porte rien ligne à ligne. Empilée, c'est un calendrier d'assiduité — et
    // son ABSENCE parle autant que sa présence : une semaine sans ligne est une semaine sans rien écrire.
    const vieille = `vieux-${t}`;
    const recente = `recent-${t}`;
    // Les DEUX horodatages sont explicites : sur un tableau hétérogène, PostgREST comble la colonne
    // manquante par NULL au lieu d'appliquer le `default`, et l'insertion entière est refusée.
    await ecrire("notification_envoyee", [
      {
        utilisatrice_id: elle.id,
        motif: "synthese_prete",
        cle: vieille,
        envoye_le: new Date(Date.now() - (RETENTION_NOTIFICATION_JOURS + 2) * 86_400_000).toISOString(),
      },
      {
        utilisatrice_id: elle.id,
        motif: "synthese_prete",
        cle: recente,
        envoye_le: new Date().toISOString(),
      },
    ]);

    await rpc("purger_notifications_envoyees", { p_jours: RETENTION_NOTIFICATION_JOURS });

    const { data } = await admin
      .from("notification_envoyee")
      .select("cle")
      .eq("utilisatrice_id", elle.id)
      .in("cle", [vieille, recente]);
    expect(data!.map((l) => l.cle)).toEqual([recente]);
  });

  it("une durée absente ou nulle LÈVE — elle ne purge pas en silence", async () => {
    // `make_interval(days => null)` rend NULL, donc `envoye_le < NULL` rend NULL, donc la purge ne
    // supprimerait rien. Une rétention qui ne fait rien en silence est indistinguable d'une rétention
    // absente. Mutation-cible : retirer la garde.
    for (const p_jours of [null, 0, -5]) {
      await expect(
        admin.rpc("purger_notifications_envoyees", { p_jours }).then(({ error }) => {
          if (error) throw new Error(error.message);
        }),
      ).rejects.toThrow(/retention_notification_invalide/);
    }
  });
});

describe("ce que la RLS et les droits laissent voir", () => {
  it("[LE CŒUR] les fonctions du canal ne sont exécutables NI par `anon` NI par une session", async () => {
    // `security definer` + `revoke` : sans le revoke, Supabase accorde `execute` à `anon` et
    // `authenticated` par défaut sur toute nouvelle fonction `public`. N'importe qui pourrait alors
    // moissonner des jetons ou désabonner en masse, directement par PostgREST.
    //
    // ── CE TEST ÉTAIT UNE TAUTOLOGIE ─────────────────────────────────────────────────────────────────
    //
    // Il appelait les trois fonctions avec un objet d'arguments FUSIONNÉ (`p_utilisatrice` + `p_jeton` +
    // `p_refuse` + `p_jours`) et se contentait d'`expect(error).not.toBeNull()`. Aucune signature ne
    // correspondait, donc PostgREST répondait « fonction introuvable » — une erreur, oui, mais pas celle
    // qu'on croyait mesurer. La mutation-vérification l'a prouvé : rendre `execute` à `anon` laissait ce
    // test VERT.
    //
    // On appelle donc chaque fonction avec SES arguments, et surtout on vérifie l'EFFET : c'est le seul
    // fait que ni un mauvais nom d'argument ni une erreur de droits ne peuvent simuler.
    const anonyme = createClient(url, publishable, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: avant } = await admin
      .from("preference_courriel")
      .select("refuse_le")
      .eq("utilisatrice_id", elle.id)
      .single();

    const appels: [string, Record<string, unknown>][] = [
      ["jeton_courriel", { p_utilisatrice: elle.id }],
      ["regler_courriels_par_jeton", { p_jeton: jeton, p_refuse: !avant!.refuse_le }],
      ["purger_notifications_envoyees", { p_jours: 1 }],
    ];
    for (const [fn, args] of appels) {
      const { data, error } = await anonyme.rpc(fn, args);
      expect(error, `${fn} doit être hors d'atteinte`).not.toBeNull();
      expect(data, `${fn} ne doit RIEN rendre`).toBeNull();
    }

    // L'EFFET : le refus n'a pas bougé. `regler_courriels_par_jeton` demandait pourtant l'inverse de
    // l'état courant — s'il s'était exécuté, cette ligne rougirait, quelle que soit la réponse HTTP.
    const { data: apres } = await admin
      .from("preference_courriel")
      .select("refuse_le")
      .eq("utilisatrice_id", elle.id)
      .single();
    expect(apres!.refuse_le, "aucun effet : la fonction n'a pas tourné").toBe(avant!.refuse_le);
  });

  it("elle lit SA préférence (c'est ce qui la met dans son export), et personne d'autre", async () => {
    const session = createClient(url, publishable, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: err } = await session.auth.signInWithPassword({
      email: elle.email,
      password: elle.motDePasse,
    });
    expect(err).toBeNull();

    const { data } = await session.from("preference_courriel").select("refuse_le, maj_le");
    expect(data, "sa ligne, et seulement elle").toHaveLength(1);

    // Aucune policy d'écriture : la préférence ne se modifie que par les fonctions gardées. Une écriture
    // bloquée par la RLS ne LÈVE PAS — elle ne touche simplement aucune ligne, et PostgREST répond 204
    // sans erreur. C'est exactement pourquoi on vérifie la VALEUR et pas le code de retour : un test qui
    // se contenterait d'`expect(error).not.toBeNull()` mesurerait ici quelque chose qui n'arrive jamais.
    const avant = data![0].refuse_le;
    await session.from("preference_courriel").update({ refuse_le: null }).eq("utilisatrice_id", elle.id);

    const { data: apres } = await admin
      .from("preference_courriel")
      .select("refuse_le")
      .eq("utilisatrice_id", elle.id)
      .single();
    expect(apres!.refuse_le, "rien n'a bougé").toBe(avant);

    const anonyme = createClient(url, publishable, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: rienDuTout } = await anonyme.from("preference_courriel").select("jeton");
    expect(rienDuTout ?? [], "deny-by-default pour qui n'a pas de session").toEqual([]);
  });
});
