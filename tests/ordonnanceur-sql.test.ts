import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 4.8 (T2) — LA GARANTIE À L'ÉCRITURE. Tout ce qui suit se joue en base, sous `service_role`, contre
 * le vrai Postgres local.
 *
 * Pourquoi ici et pas dans le TypeScript : l'idempotence d'un job n'est pas une propriété du répartiteur,
 * c'est une propriété de la RÉCLAMATION. Un répartiteur peut être réécrit, doublé, appelé deux fois par un
 * rejeu de Vercel ; la contrainte d'unicité, elle, ne se contourne pas. Un test qui prouverait l'idempotence
 * en mockant la base ne prouverait que la politesse du code appelant.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const t = Date.now();
const MDP = "test-ordo-123!";
/** Préfixe de course : isole ces lignes de tout autre fichier de tests tournant en parallèle. */
const P = `essai-${t}`;

async function reclamer(job: string, fenetre: string, cible: string | null, bail: number): Promise<boolean> {
  const { data, error } = await admin.rpc("reclamer_execution", {
    p_job: job,
    p_fenetre: fenetre,
    p_cible_id: cible,
    p_bail_secondes: bail,
  });
  if (error) throw new Error(`reclamer: ${error.message}`);
  return data as boolean;
}
async function clore(job: string, fenetre: string, cible: string | null, reussi: boolean, motif: string | null) {
  const { error } = await admin.rpc("clore_execution", {
    p_job: job,
    p_fenetre: fenetre,
    p_cible_id: cible,
    p_reussi: reussi,
    p_motif: motif,
  });
  if (error) throw new Error(`clore: ${error.message}`);
}
async function ligne(job: string, fenetre: string) {
  const { data } = await admin.from("execution_job").select("*").eq("job", job).eq("fenetre", fenetre).single();
  return data as { statut: string; tentatives: number; motif_echec: string | null; termine_le: string | null };
}

describe("[AC2] la réclamation — une fenêtre, un effet", () => {
  afterAll(async () => {
    await admin.from("execution_job").delete().like("job", `${P}%`);
    await admin.from("incident_systeme").delete().like("job", `${P}%`);
  });

  it("deux réclamations dans la MÊME fenêtre : la seconde est refusée, et il n'existe qu'UNE ligne", async () => {
    const job = `${P}-nominal`;
    expect(await reclamer(job, "2026-08-05", null, 300)).toBe(true);
    expect(await reclamer(job, "2026-08-05", null, 300)).toBe(false);
    const { count } = await admin.from("execution_job").select("*", { count: "exact", head: true }).eq("job", job);
    expect(count).toBe(1);
  });

  it("[LE CŒUR] une fenêtre RÉUSSIE n'est plus jamais réclamable", async () => {
    // Mutation-cible : ajouter `or statut = 'reussi'` au `where` du DO UPDATE. Le rejeu d'un tick — que
    // Vercel Cron peut parfaitement produire — refabriquerait alors une synthèse, renverrait une
    // notification, ou (Epic 6) relancerait une purge. C'est LA ligne qui porte l'AC2.
    const job = `${P}-reussi`;
    await reclamer(job, "2026-08-05", null, 300);
    await clore(job, "2026-08-05", null, true, null);
    expect(await reclamer(job, "2026-08-05", null, 300)).toBe(false);
    expect((await ligne(job, "2026-08-05")).statut).toBe("reussi");
  });

  it("la fenêtre SUIVANTE est réclamable — l'idempotence n'est pas un blocage définitif", async () => {
    const job = `${P}-suivante`;
    await reclamer(job, "2026-08-05", null, 300);
    await clore(job, "2026-08-05", null, true, null);
    expect(await reclamer(job, "2026-08-06", null, 300)).toBe(true);
  });

  it("[AC5] une fenêtre ÉCHOUÉE est immédiatement re-réclamable, et compte ses tentatives", async () => {
    const job = `${P}-echec`;
    await reclamer(job, "2026-08-05", null, 300);
    await clore(job, "2026-08-05", null, false, "code_court");
    expect((await ligne(job, "2026-08-05")).motif_echec).toBe("code_court");
    expect(await reclamer(job, "2026-08-05", null, 300)).toBe(true);
    const apres = await ligne(job, "2026-08-05");
    expect(apres.tentatives).toBe(2);
    expect(apres.statut).toBe("en_cours");
    expect(apres.motif_echec, "une nouvelle tentative repart propre").toBeNull();
  });

  it("[AC5] un bail EXPIRÉ rend la main ; un bail VIVANT la refuse", async () => {
    // Mutation-cible : retirer la clause de bail expiré. Un processus tué au milieu de son job (un
    // redémarrage serverless suffit) immobiliserait sa fenêtre pour toujours — le job ne repartirait
    // jamais, et rien ne le dirait, puisque la ligne existe et a l'air en cours.
    const mort = `${P}-bail-mort`;
    await reclamer(mort, "2026-08-05", null, -60); // bail déjà expiré à l'écriture
    expect(await reclamer(mort, "2026-08-05", null, 300)).toBe(true);

    const vivant = `${P}-bail-vivant`;
    await reclamer(vivant, "2026-08-05", null, 300);
    expect(await reclamer(vivant, "2026-08-05", null, 300)).toBe(false);
  });

  it("[nulls not distinct] deux jobs GLOBAUX se dédoublonnent ; deux CIBLES restent indépendantes", async () => {
    // Mutation-cible : retirer `nulls not distinct` de l'index. Postgres considère alors deux `null` comme
    // distincts, l'index cesse de dédoublonner les jobs globaux — et le `on conflict` ne se déclenche
    // jamais : chaque tick INSÈRE. Le premier test de ce fichier tomberait, ce qui est exactement ce qu'on
    // veut : la faille est invisible à l'œil nu et n'apparaîtrait qu'en production.
    const job = `${P}-cibles`;
    expect(await reclamer(job, "2026-08-05", null, 300)).toBe(true);
    expect(await reclamer(job, "2026-08-05", null, 300)).toBe(false);

    const { data: u } = await admin.auth.admin.createUser({
      email: `ordo-cible-${t}@exemple.fr`,
      password: MDP,
      email_confirm: true,
    });
    const { data: u2 } = await admin.auth.admin.createUser({
      email: `ordo-cible2-${t}@exemple.fr`,
      password: MDP,
      email_confirm: true,
    });
    expect(await reclamer(job, "2026-08-05", u!.user!.id, 300), "cible A : indépendante du global").toBe(true);
    expect(await reclamer(job, "2026-08-05", u2!.user!.id, 300), "cible B : indépendante de A").toBe(true);
    expect(await reclamer(job, "2026-08-05", u!.user!.id, 300), "cible A, deux fois : refusée").toBe(false);

    // [FR-067] l'effacement d'une utilisatrice emporte ses lignes d'exécution.
    await admin.auth.admin.deleteUser(u!.user!.id);
    const { count } = await admin
      .from("execution_job")
      .select("*", { count: "exact", head: true })
      .eq("cible_id", u!.user!.id);
    expect(count, "cascade FR-067").toBe(0);
    await admin.auth.admin.deleteUser(u2!.user!.id);
  });

  it("[NFR-022] un motif d'échec trop long est TRONQUÉ, jamais rejeté", async () => {
    // Deux exigences en tension : la contrainte de 120 caractères (structure anti-art. 9) et le fait qu'on
    // écrit ce motif DANS un chemin d'erreur. Si la contrainte levait, on perdrait la trace de l'échec
    // qu'on essayait justement d'enregistrer — l'erreur mangerait sa propre trace.
    const job = `${P}-tronque`;
    await reclamer(job, "2026-08-05", null, 300);
    await clore(job, "2026-08-05", null, false, "x".repeat(500));
    expect((await ligne(job, "2026-08-05")).motif_echec).toHaveLength(120);
  });
});

describe("[AC5] les incidents — une alerte par job et par jour", () => {
  afterAll(async () => {
    await admin.from("incident_systeme").delete().like("job", `${P}%`);
  });

  it("le second incident du même jour ne crée pas de seconde ligne — et n'ÉCHOUE pas non plus", async () => {
    // Mutation-cible : retirer le `on conflict do nothing`. Un job mort produirait une ligne par tick, et
    // l'information « ce job est mort » se noierait dans sa propre répétition.
    //
    // ⚠️ CE TEST A DÛ ÊTRE RÉÉCRIT. Première version : deux appels, puis `count === 1`. Elle passait AUSSI
    // sans le `on conflict do nothing` — parce que l'index unique dédoublonne alors en LEVANT, ce qui donne
    // le même compte. Deux défenses couvraient le même invariant, et le test ne pouvait pas dire laquelle
    // était à l'œuvre (le piège de la défense en profondeur, mémoire `gardes-doivent-tuer-leur-mutant`).
    //
    // La différence OBSERVABLE entre les deux mondes est l'ERREUR, pas le compte. Et elle est loin d'être
    // cosmétique : le job de santé lève ses incidents en série. Si le second appel lançait, le job de santé
    // se clorait lui-même en échec — l'organe qui surveille les pannes tomberait sur la deuxième panne
    // constatée dans la journée.
    const job = `${P}-incident`;
    const un = await admin.rpc("lever_incident", { p_type: "job_en_retard", p_job: job, p_detail: "a" });
    const deux = await admin.rpc("lever_incident", { p_type: "job_en_retard", p_job: job, p_detail: "b" });
    expect(un.error).toBeNull();
    expect(deux.error, "un second incident du jour est un NON-ÉVÉNEMENT, pas une erreur").toBeNull();
    const { count } = await admin.from("incident_systeme").select("*", { count: "exact", head: true }).eq("job", job);
    expect(count).toBe(1);
  });

  it("deux TYPES différents pour le même job restent deux incidents", async () => {
    const job = `${P}-deux-types`;
    await admin.rpc("lever_incident", { p_type: "job_en_retard", p_job: job, p_detail: null });
    await admin.rpc("lever_incident", { p_type: "job_echoue", p_job: job, p_detail: null });
    const { count } = await admin.from("incident_systeme").select("*", { count: "exact", head: true }).eq("job", job);
    expect(count).toBe(2);
  });

  it("un type inconnu est REFUSÉ par la contrainte", async () => {
    const { error } = await admin.rpc("lever_incident", {
      p_type: "job_bizarre",
      p_job: `${P}-inconnu`,
      p_detail: null,
    });
    expect(error, "la liste des types est fermée").not.toBeNull();
  });
});

describe("[AC3] le marqueur d'environnement", () => {
  it("il existe, il est unique, et il vaut `local` en développement", async () => {
    const { data } = await admin.from("environnement").select("nom");
    expect(data).toHaveLength(1);
    expect(data![0].nom).toBe("local");
  });

  it("il ne se SUPPRIME pas", async () => {
    // Mutation-cible : retirer le trigger. La base deviendrait muette sur son identité — le répartiteur
    // se replierait alors sur le refus (donc l'invariant tiendrait), mais un refus muet se diagnostique
    // très mal. L'erreur franche à la suppression dit tout de suite ce qui a été cassé.
    const { error } = await admin.from("environnement").delete().eq("id", true);
    expect(error?.message ?? "").toMatch(/ne se supprime pas/i);
    const { data } = await admin.from("environnement").select("nom");
    expect(data, "et la ligne est toujours là").toHaveLength(1);
  });

  it("un nom d'environnement inventé est refusé", async () => {
    const { error } = await admin.from("environnement").update({ nom: "recette" }).eq("id", true);
    expect(error).not.toBeNull();
  });
});

describe("[AD-12 / NFR-020] les tables de l'ordonnanceur sont invisibles à toute session", () => {
  const u = { email: `ordo-rls-${t}@exemple.fr`, id: "" };
  let session: SupabaseClient;

  beforeAll(async () => {
    if (!url || !publishable || !secret) throw new Error("Supabase local requis.");
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: MDP,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    u.id = data.user!.id;
    session = createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });
    await session.auth.signInWithPassword({ email: u.email, password: MDP });
    await admin.rpc("reclamer_execution", {
      p_job: `${P}-rls`,
      p_fenetre: "2026-08-05",
      p_cible_id: u.id,
      p_bail_secondes: 300,
    });
    await admin.rpc("lever_incident", { p_type: "job_echoue", p_job: `${P}-rls`, p_detail: "code" });
  });
  afterAll(async () => {
    await admin.from("execution_job").delete().like("job", `${P}%`);
    await admin.from("incident_systeme").delete().like("job", `${P}%`);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("une utilisatrice ne voit RIEN — pas même la ligne qui porte son propre identifiant", async () => {
    // Le détail qui compte : la ligne `execution_job` insérée ci-dessus a `cible_id = u.id`. Une policy
    // « possédée » naïve (`auth.uid() = cible_id`) la lui rendrait visible. Ces tables n'appartiennent à
    // personne : elles sont en deny-by-default, sans aucune policy.
    for (const table of ["execution_job", "incident_systeme", "environnement"]) {
      const { data } = await session.from(table).select("*");
      expect(data ?? [], `${table} doit être vide sous JWT`).toEqual([]);
    }
  });

  it("elle ne peut RIEN y écrire — et l'UPDATE ne se prouve pas comme l'INSERT", async () => {
    // Piège payé en écrivant ce test : un INSERT refusé par la RLS LÈVE (42501), mais un UPDATE refusé par
    // la RLS ne lève PAS — il ne voit simplement aucune ligne à modifier et renvoie un succès à zéro effet.
    // Une boucle qui exigerait `error != null` partout échouerait donc sur l'update… et, écrite à l'envers
    // (« pas d'erreur = pas d'écriture »), elle aurait passé même si l'update avait RÉUSSI. Les deux formes
    // se prouvent différemment : l'insertion par son refus, la mise à jour par son ABSENCE D'EFFET.
    const insertions = await Promise.all([
      session.from("execution_job").insert({ job: "pirate", fenetre: "x", statut: "reussi", bail_expire_le: "now()" }),
      session.from("incident_systeme").insert({ type: "job_echoue", job: "pirate" }),
      session.from("environnement").insert({ nom: "production" }),
    ]);
    for (const r of insertions) expect(r.error, "insertion refusée").not.toBeNull();

    await session.from("environnement").update({ nom: "production" }).eq("id", true);
    const { data } = await admin.from("environnement").select("nom");
    expect(data![0].nom, "l'environnement déclaré n'a PAS bougé").toBe("local");

    await session.from("execution_job").delete().like("job", `${P}%`);
    const { count } = await admin.from("execution_job").select("*", { count: "exact", head: true }).like("job", `${P}%`);
    expect(count, "et elle ne peut pas non plus effacer les traces").toBeGreaterThan(0);
  });

  it("elle ne peut appeler AUCUNE des RPC de l'ordonnanceur", async () => {
    // Mutation-cible : oublier un `revoke execute`. Supabase accorde AUTOMATIQUEMENT `execute` à
    // `authenticated` sur toute nouvelle fonction du schéma `public` (leçon de la migration 0007) — ces
    // fonctions sont en `security definer`, donc un grant oublié donnerait à n'importe quelle session le
    // droit de forger des exécutions et d'étouffer les jobs réels en réclamant leurs fenêtres.
    const appels = [
      session.rpc("reclamer_execution", { p_job: "p", p_fenetre: "f", p_cible_id: null, p_bail_secondes: 1 }),
      session.rpc("clore_execution", { p_job: "p", p_fenetre: "f", p_cible_id: null, p_reussi: true, p_motif: null }),
      session.rpc("lever_incident", { p_type: "job_echoue", p_job: "p", p_detail: null }),
      session.rpc("etat_ordonnanceur"),
      session.rpc("sante_ordonnanceur_publique"),
    ];
    for (const r of await Promise.all(appels)) expect(r.error, "RPC refusée sous JWT").not.toBeNull();
  });
});

describe("[NFR-020] l'absence d'art. 9 est STRUCTURELLE, pas disciplinaire", () => {
  const job = `${P}-forme`;
  afterAll(async () => {
    await admin.from("execution_job").delete().like("job", `${P}%`);
    await admin.from("incident_systeme").delete().like("job", `${P}%`);
  });

  it("aucune des trois tables ne porte de colonne capable d'accueillir du contenu", async () => {
    // Mutation-cible : ajouter une colonne `message text` à `execution_job` « pour faciliter le débogage ».
    // C'est exactement comme ça qu'un verbatim finit dans une table système : par commodité, une fois.
    // Ce test FIGE la liste — en ajouter une suppose de venir ici et d'écrire pourquoi.
    //
    // On peuple d'abord, puis on lit : `select *` sur une table vide ne renvoie aucune clé, et un tel test
    // « passerait » sans rien vérifier — le pire des faux verts.
    await reclamer(job, "2026-08-05", null, 300);
    await admin.rpc("lever_incident", { p_type: "job_echoue", p_job: job, p_detail: "code" });

    const attendu: Record<string, string[]> = {
      environnement: ["fige_le", "id", "nom"],
      execution_job: [
        "bail_expire_le",
        "cible_id",
        "commence_le",
        "fenetre",
        "id",
        "job",
        "motif_echec",
        "statut",
        "tentatives",
        "termine_le",
      ],
      incident_systeme: ["cree_le", "detail", "id", "job", "jour", "type"],
    };
    for (const [table, colonnes] of Object.entries(attendu)) {
      const { data, error } = await admin.from(table).select("*").limit(1);
      expect(error, table).toBeNull();
      expect((data ?? []).length, `${table} doit être peuplée pour que ce test veuille dire quelque chose`).toBe(1);
      expect(Object.keys(data![0]).sort(), table).toEqual(colonnes);
    }
  });
});

describe("[AC3 — défaut n°2] une base FRAÎCHEMENT MIGRÉE ne s'accorde avec aucun déploiement", () => {
  it("la migration 0027 n'amorce PAS le marqueur — le repli de la garde et le défaut de la base ne portent plus le même mot", () => {
    // LE DÉFAUT. La migration insérait `local`, et `environnementDuDeploiement()` se replie sur `local`
    // quand `ANIMA_ENV` est absente ou méconnaissable. Les DEUX « je ne sais pas » du verrou portaient donc
    // le même mot — et deux ignorances qui portent le même mot ne se contredisent pas : elles s'accordent.
    //
    // Concrètement : un projet cloud migré mais pas encore promu déclarait `local` ; un `npm run dev`
    // pointé sur lui (ANIMA_ENV=local, comme dans `.env.example`) obtenait un verdict ACCORDÉ, réclamait
    // la fenêtre du jour et la clôturait en `reussi` — le vrai tick de 6 h trouvait alors `deja_fait`. Un
    // poste de développement pouvait éteindre la journée de production. Et à l'Epic 6, ce même chemin
    // exécute la rétention, c'est-à-dire l'effacement de données réelles (AD-14) : exactement l'accident
    // que l'AC3 prétend tuer.
    //
    // Une garde de SOURCE, ici, et pas de comportement : la base locale a bien son marqueur (par
    // `seed.sql`), donc aucune requête ne peut montrer l'état « fraîchement migré ». Ce qu'on vérifie,
    // c'est ce que reçoit un projet CLOUD — qui, lui, ne reçoit que les migrations.
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/0027_ordonnanceur.sql"), "utf-8");
    const insertions = migration.match(/insert\s+into\s+public\.environnement/gi) ?? [];
    expect(insertions, "aucun amorçage du marqueur dans une migration").toEqual([]);

    // … et le marqueur local vient bien d'ailleurs : sans ça, la CI et le poste local n'auraient plus de
    // marqueur du tout et TOUS les tests d'ordonnanceur tomberaient en `base_muette` — vert par accident.
    const seed = readFileSync(resolve(process.cwd(), "supabase/seed.sql"), "utf-8");
    expect(seed).toMatch(/insert\s+into\s+public\.environnement[\s\S]*'local'/i);
  });

  it("le marqueur de CETTE base dit bien `local`, et il est indélébile", async () => {
    const { data } = await admin.from("environnement").select("nom, id");
    expect(data, "exactement une ligne : `id` est un booléen contraint à `true`").toHaveLength(1);
    expect(data![0].nom).toBe("local");

    // Le trigger `environnement_indelebile` : une base sans marqueur retomberait dans `base_muette` (donc
    // le refus, donc l'invariant tiendrait) — mais un refus muet se diagnostique mal. On préfère l'erreur
    // franche, qui dit tout de suite ce qui a été cassé.
    const { error } = await admin.from("environnement").delete().eq("id", true);
    expect(error, "la suppression du marqueur lève").not.toBeNull();
  });
});
