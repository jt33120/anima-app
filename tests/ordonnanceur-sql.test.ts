import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
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

/** Rend le JETON de propriété (Story 6.1a), ou `null` si la fenêtre est déjà tenue. */
async function reclamer(job: string, fenetre: string, cible: string | null, bail: number): Promise<string | null> {
  const { data, error } = await admin.rpc("reclamer_execution", {
    p_job: job,
    p_fenetre: fenetre,
    p_cible_id: cible,
    p_bail_secondes: bail,
  });
  if (error) throw new Error(`reclamer: ${error.message}`);
  return (data as string | null) ?? null;
}

/** Le jeton que la base considère comme courant — c'est-à-dire celui du DÉTENTEUR LÉGITIME. */
async function jetonCourant(job: string, fenetre: string, cible: string | null): Promise<string> {
  let q = admin.from("execution_job").select("jeton").eq("job", job).eq("fenetre", fenetre);
  q = cible === null ? q.is("cible_id", null) : q.eq("cible_id", cible);
  const { data, error } = await q.single();
  if (error) throw new Error(`jetonCourant: ${error.message}`);
  return (data as { jeton: string }).jeton;
}

/**
 * ⚠️ `jeton` est OPTIONNEL ici, et il ne l'est nulle part ailleurs. Sans jeton, cette aide va lire
 * celui de la base : elle joue donc le DÉTENTEUR LÉGITIME, ce qui est le chemin nominal de la
 * quasi-totalité des tests de ce fichier et évite d'en réécrire vingt pour une raison de plomberie.
 *
 * Les tests qui portent SUR le jeton, eux, en passent un explicitement — un jeton périmé, un jeton
 * d'une autre ligne. C'est là, et seulement là, que la garde de propriété est mise à l'épreuve : si
 * on la retirait de la SQL, ce sont ces tests-là qui doivent virer au rouge, pas les autres.
 */
async function clore(
  job: string,
  fenetre: string,
  cible: string | null,
  reussi: boolean,
  motif: string | null,
  jeton?: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc("clore_execution", {
    p_job: job,
    p_fenetre: fenetre,
    p_cible_id: cible,
    p_reussi: reussi,
    p_motif: motif,
    p_jeton: jeton ?? (await jetonCourant(job, fenetre, cible)),
  });
  if (error) throw new Error(`clore: ${error.message}`);
  return data as boolean;
}
async function ligne(job: string, fenetre: string) {
  const { data } = await admin.from("execution_job").select("*").eq("job", job).eq("fenetre", fenetre).single();
  return data as {
    statut: string;
    tentatives: number;
    motif_echec: string | null;
    termine_le: string | null;
    jeton: string;
  };
}

describe("[REVUE 4.9 / T6-19] une fenêtre TERMINÉE ne se rouvre pas", () => {
  afterAll(async () => {
    await admin.from("execution_job").delete().like("job", `${P}t619%`);
  });

  it("[LE CŒUR] une clôture tardive n'écrase pas un `reussi` — et ne le rend pas re-réclamable", async () => {
    // La migration 0027 l'AFFIRMAIT en toutes lettres : « une ligne `reussi` n'est JAMAIS re-réclamable —
    // c'est là que vit l'idempotence de la fenêtre ». C'était faux, et vérifié faux : `clore_execution`
    // écrasait `reussi` en `echoue` sans condition, et une ligne `echoue` EST re-réclamable.
    //
    // Le scénario : une exécution lente clôt en échec APRÈS qu'une autre, relancée sur bail expiré, ait
    // réussi. La fenêtre rouvre. Sans conséquence sur la synthèse (l'unicité de la période rattrape) ;
    // aucun index ne rattrapera une PURGE de rétention rejouée (Epic 6), que `executer.ts` promet
    // explicitement de protéger par ce mécanisme.
    // Mutation-cible : retirer `and statut = 'en_cours'`.
    const job = `${P}t619-tardive`;
    expect(await reclamer(job, "f1", null, 60)).not.toBeNull();
    await clore(job, "f1", null, true, null);

    await clore(job, "f1", null, false, "arrivée trop tard");

    const apres = await ligne(job, "f1");
    expect(apres.statut, "toujours réussi").toBe("reussi");
    expect(apres.motif_echec, "et aucun motif d'échec inventé après coup").toBeNull();
    expect(await reclamer(job, "f1", null, 60), "et la fenêtre reste fermée").toBeNull();
  });

  it("[CONTRÔLE POSITIF] une exécution EN COURS se clôt bien, dans les deux sens", async () => {
    // Sans lui, la garde ci-dessus serait satisfaite par un `clore_execution` qui ne ferait plus jamais
    // rien — toutes les fenêtres resteraient `en_cours`, l'ordonnanceur ne fermerait plus rien, et le
    // test le plus vert du fichier ne prouverait rien.
    const job = `${P}t619-normale`;
    expect(await reclamer(job, "ok", null, 60)).not.toBeNull();
    await clore(job, "ok", null, true, null);
    expect((await ligne(job, "ok")).statut).toBe("reussi");

    expect(await reclamer(job, "ko", null, 60)).not.toBeNull();
    await clore(job, "ko", null, false, "panne_franche");
    const echoue = await ligne(job, "ko");
    expect(echoue.statut).toBe("echoue");
    expect(echoue.motif_echec).toBe("panne_franche");
    expect(await reclamer(job, "ko", null, 60), "un échec, lui, se re-réclame").not.toBeNull();
  });
});

describe("[6.1a/AC1] le JETON de propriété — seul celui qui tient la fenêtre peut la clore", () => {
  afterAll(async () => {
    await admin.from("execution_job").delete().like("job", `${P}jeton%`);
  });

  it("[LE CŒUR] l'exécution GELÉE qui revient ne clôt plus le travail de sa remplaçante", async () => {
    // LE SCÉNARIO, exactement celui que `deferred-work.md` nomme depuis la 4.9 sous T6-19 :
    //
    //   A réclame la fenêtre, part travailler, et se fait geler (redémarrage serverless, GC, réseau).
    //   Le bail expire. B réclame la même fenêtre — LÉGITIMEMENT, c'est le mécanisme de reprise.
    //   A revient à la vie et clôt. La ligne est `en_cours` (celle de B), donc le durcissement de 0035
    //   ne la protège pas : la clôture de A s'applique à l'exécution de B.
    //
    // Sur la rétention (Epic 6), les deux issues sont mauvaises. A clôt en `reussi` un effacement que
    // B est en train de faire et qui va échouer : la fenêtre est réputée purgée, rien ne repassera
    // jamais. Ou A clôt en `echoue` ce que B a réussi : la fenêtre redevient réclamable, et la purge
    // REJOUE. Aucun index ne rattrape ni l'un ni l'autre.
    //
    // Mutation-cible : retirer `and jeton = p_jeton` de `clore_execution`.
    const job = `${P}jeton-gelee`;
    const jetonA = await reclamer(job, "f", null, -60); // bail déjà expiré : A part travailler et se fige
    expect(jetonA, "A a bien pris la main").not.toBeNull();

    const jetonB = await reclamer(job, "f", null, 300); // B reprend la main, légitimement
    expect(jetonB, "B reprend sur bail expiré").not.toBeNull();
    expect(jetonB, "…et le jeton a été REFRAPPÉ : le reconduire rendrait la colonne décorative").not.toBe(jetonA);

    expect(await clore(job, "f", null, true, null, jetonA!), "A revient : sa clôture est REFUSÉE").toBe(false);
    const apres = await ligne(job, "f");
    expect(apres.statut, "l'exécution de B court toujours").toBe("en_cours");
    expect(apres.jeton, "et la ligne appartient toujours à B").toBe(jetonB);

    // CONTRÔLE POSITIF, dans le même test parce qu'il porte sur la même ligne : B, lui, clôt.
    expect(await clore(job, "f", null, true, null, jetonB!), "B clôt").toBe(true);
    expect((await ligne(job, "f")).statut).toBe("reussi");
  });

  it("un jeton INVENTÉ ne clôt rien, et un jeton d'une AUTRE ligne non plus", async () => {
    // La garde ne doit pas se contenter de « un jeton, n'importe lequel » : c'est la faute qu'on
    // écrirait en comparant à `is not null`. Chaque ligne a le sien.
    const a = `${P}jeton-a`;
    const b = `${P}jeton-b`;
    const jetonA = (await reclamer(a, "f", null, 300))!;
    const jetonB = (await reclamer(b, "f", null, 300))!;

    expect(await clore(a, "f", null, true, null, "00000000-0000-4000-8000-000000000000"), "inventé").toBe(false);
    expect(await clore(a, "f", null, true, null, jetonB), "celui du voisin").toBe(false);
    expect((await ligne(a, "f")).statut, "rien n'a bougé").toBe("en_cours");
    expect(await clore(a, "f", null, true, null, jetonA), "le sien, enfin").toBe(true);
  });

  it("la clôture RÉPOND — un refus se distingue d'une réussite, et ne lève pas", async () => {
    // `clore_execution` rendait `void` : l'appelant ne pouvait pas distinguer « j'ai clos » de « on
    // m'a refusé ». C'est la même leçon que le chemin `deja_fait` de la 6.1 — une absence d'effet
    // qu'on ne peut pas montrer ne vaut pas mieux qu'un travail non fait. Sur un rejeu de purge
    // (6.8), « la clôture a été refusée parce qu'un autre détenait la fenêtre » est exactement la
    // phrase à pouvoir produire.
    //
    // Et un refus NE LÈVE PAS : c'est un non-événement. S'il levait, `executer.ts` le traiterait en
    // panne de mécanique et lèverait un incident mensonger.
    const job = `${P}jeton-reponse`;
    const jeton = (await reclamer(job, "f", null, 300))!;
    expect(await clore(job, "f", null, true, null, jeton), "la première clôture agit").toBe(true);
    expect(await clore(job, "f", null, true, null, jeton), "la seconde ne fait plus rien, et le dit").toBe(false);
  });

  it("[ÉCHOUER FERMÉ] un jeton ABSENT ne clôt rien, et la colonne ne peut pas être vide", async () => {
    // ⚠️ POURQUOI `=` ET SURTOUT PAS `is not distinct from`. Sur `cible_id`, `is not distinct from` est
    // indispensable : `null` y est une VALEUR MÉTIER (« job global »). Sur le jeton, `null` ne serait
    // qu'une ignorance — et `is not distinct from` la ferait s'accorder avec elle-même. Le pire n'est
    // pas la comparaison, c'est le raccourci de compatibilité qu'on écrit sans y penser le jour où un
    // appelant n'a pas de jeton : `and (p_jeton is null or jeton = p_jeton)`. Il ouvre une porte
    // exactement de la taille de la garde.
    //
    // Deux affirmations, et elles se cassent séparément :
    //   • un appelant SANS jeton ne clôt rien ;
    //   • et aucune ligne ne peut avoir un jeton vide qui viendrait s'accorder avec lui.
    // Mutation-cible : `and (p_jeton is null or jeton = p_jeton)` ; puis retirer le `not null`.
    const job = `${P}jeton-absent`;
    await reclamer(job, "f", null, 300);

    const { data, error } = await admin.rpc("clore_execution", {
      p_job: job,
      p_fenetre: "f",
      p_cible_id: null,
      p_reussi: true,
      p_motif: null,
      p_jeton: null,
    });
    expect(error, "l'appel aboutit — un refus n'est pas une erreur").toBeNull();
    expect(data, "…mais il ne clôt RIEN").toBe(false);
    expect((await ligne(job, "f")).statut, "la ligne n'a pas bougé").toBe("en_cours");

    const vide = await admin.from("execution_job").insert({
      job: `${P}jeton-vide`,
      fenetre: "f",
      statut: "en_cours",
      bail_expire_le: new Date().toISOString(),
      jeton: null,
    });
    expect(vide.error?.message ?? "", "et la colonne refuse le vide").toMatch(/null value|not-null/i);
  });

  it("[LA PORTE À CÔTÉ] l'ANCIENNE signature à cinq arguments n'existe plus", async () => {
    // ⚠️ `create or replace function` avec un paramètre de PLUS ne remplace RIEN : il crée une
    // SURCHARGE. L'ancienne `clore_execution(text, text, uuid, boolean, text)` resterait alors
    // publiée sur PostgREST, à côté de celle qu'on vient de garder — c'est-à-dire que le
    // contournement de la garde serait livré avec elle, et qu'aucun autre test ne le verrait : ils
    // passent tous par la nouvelle.
    //
    // Mutation-cible : retirer le `drop function if exists public.clore_execution(…)` de 0052.
    const { error } = await admin.rpc("clore_execution", {
      p_job: `${P}jeton-vieille`,
      p_fenetre: "f",
      p_cible_id: null,
      p_reussi: true,
      p_motif: null,
    });
    expect(error?.message ?? "", "la surcharge sans jeton doit avoir disparu").toMatch(
      /could not find the function/i,
    );
  });

  it("chaque prise de main frappe un jeton NEUF, y compris après un échec", async () => {
    // Le chemin `echoue` est re-réclamable immédiatement (AC5). Si le jeton n'y était pas refrappé,
    // une exécution ayant échoué garderait le droit de clore la tentative suivante.
    const job = `${P}jeton-echec`;
    const un = (await reclamer(job, "f", null, 300))!;
    await clore(job, "f", null, false, "panne_franche", un);
    const deux = (await reclamer(job, "f", null, 300))!;
    expect(deux, "une nouvelle tentative, un nouveau jeton").not.toBe(un);
    expect(await clore(job, "f", null, true, null, un), "l'ancien ne vaut plus rien").toBe(false);
  });
});

describe("[AC2] la réclamation — une fenêtre, un effet", () => {
  afterAll(async () => {
    await admin.from("execution_job").delete().like("job", `${P}%`);
    await admin.from("incident_systeme").delete().like("job", `${P}%`);
  });

  it("deux réclamations dans la MÊME fenêtre : la seconde est refusée, et il n'existe qu'UNE ligne", async () => {
    const job = `${P}-nominal`;
    expect(await reclamer(job, "2026-08-05", null, 300)).not.toBeNull();
    expect(await reclamer(job, "2026-08-05", null, 300)).toBeNull();
    const { count } = await admin.from("execution_job").select("*", { count: "exact", head: true }).eq("job", job);
    expect(count).toBe(1);
  });

  it("[LE CŒUR] une fenêtre RÉUSSIE n'est plus jamais réclamable", async () => {
    // Mutation-cible : ajouter `or statut = 'reussi'` au `where` du DO UPDATE. Le rejeu d'un tick — que
    // l'ordonnanceur externe peut parfaitement produire — refabriquerait alors une synthèse, renverrait une
    // notification, ou (Epic 6) relancerait une purge. C'est LA ligne qui porte l'AC2.
    const job = `${P}-reussi`;
    await reclamer(job, "2026-08-05", null, 300);
    await clore(job, "2026-08-05", null, true, null);
    expect(await reclamer(job, "2026-08-05", null, 300)).toBeNull();
    expect((await ligne(job, "2026-08-05")).statut).toBe("reussi");
  });

  it("la fenêtre SUIVANTE est réclamable — l'idempotence n'est pas un blocage définitif", async () => {
    const job = `${P}-suivante`;
    await reclamer(job, "2026-08-05", null, 300);
    await clore(job, "2026-08-05", null, true, null);
    expect(await reclamer(job, "2026-08-06", null, 300)).not.toBeNull();
  });

  it("[AC5] une fenêtre ÉCHOUÉE est immédiatement re-réclamable, et compte ses tentatives", async () => {
    const job = `${P}-echec`;
    await reclamer(job, "2026-08-05", null, 300);
    await clore(job, "2026-08-05", null, false, "code_court");
    expect((await ligne(job, "2026-08-05")).motif_echec).toBe("code_court");
    expect(await reclamer(job, "2026-08-05", null, 300)).not.toBeNull();
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
    expect(await reclamer(mort, "2026-08-05", null, 300)).not.toBeNull();

    const vivant = `${P}-bail-vivant`;
    await reclamer(vivant, "2026-08-05", null, 300);
    expect(await reclamer(vivant, "2026-08-05", null, 300)).toBeNull();
  });

  it("[nulls not distinct] deux jobs GLOBAUX se dédoublonnent ; deux CIBLES restent indépendantes", async () => {
    // Mutation-cible : retirer `nulls not distinct` de l'index. Postgres considère alors deux `null` comme
    // distincts, l'index cesse de dédoublonner les jobs globaux — et le `on conflict` ne se déclenche
    // jamais : chaque tick INSÈRE. Le premier test de ce fichier tomberait, ce qui est exactement ce qu'on
    // veut : la faille est invisible à l'œil nu et n'apparaîtrait qu'en production.
    const job = `${P}-cibles`;
    expect(await reclamer(job, "2026-08-05", null, 300)).not.toBeNull();
    expect(await reclamer(job, "2026-08-05", null, 300)).toBeNull();

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
    expect(await reclamer(job, "2026-08-05", u!.user!.id, 300), "cible A : indépendante du global").not.toBeNull();
    expect(await reclamer(job, "2026-08-05", u2!.user!.id, 300), "cible B : indépendante de A").not.toBeNull();
    expect(await reclamer(job, "2026-08-05", u!.user!.id, 300), "cible A, deux fois : refusée").toBeNull();

    // [FR-067] l'effacement d'une utilisatrice emporte ses lignes d'exécution.
    await admin.auth.admin.deleteUser(u!.user!.id);
    const { count } = await admin
      .from("execution_job")
      .select("*", { count: "exact", head: true })
      .eq("cible_id", u!.user!.id);
    expect(count, "cascade FR-067").toBe(0);
    await admin.auth.admin.deleteUser(u2!.user!.id);
  });

  it("[NFR-022] un motif d'échec non reconnu est REMPLACÉ, jamais rejeté", async () => {
    // Deux exigences en tension, et elles n'ont pas changé depuis la 4.8 : la garantie anti-art. 9 sur
    // ce qui part en base, et le fait qu'on écrit ce motif DANS un chemin d'erreur. Si la contrainte
    // levait, on perdrait la trace de l'échec qu'on essayait justement d'enregistrer — l'erreur
    // mangerait sa propre trace, et `executer.ts` laisserait la ligne `en_cours` sous son bail.
    //
    // ⚠️ CE QUI A CHANGÉ EN 6.1a : la réponse était `left(…, 120)`, c'est-à-dire « on garde les 120
    // premiers caractères ». Sur un message quelconque, ça garde le DÉBUT D'UN VERBATIM. La 6.1a ne
    // garde plus que ce qu'elle sait nommer (`code_reconnu`) — et l'invariant « jamais rejeté » tient
    // toujours, ce que ce test vérifie en asseyant qu'aucun appel ne lève.
    const job = `${P}-tronque`;
    await reclamer(job, "2026-08-05", null, 300);
    await clore(job, "2026-08-05", null, false, "x".repeat(500));
    expect((await ligne(job, "2026-08-05")).motif_echec, "trop long : remplacé").toBe("erreur_non_identifiee");

    // Une phrase courte contenant un prénom — le cas que la borne de longueur ne voyait PAS passer.
    await reclamer(job, "2026-08-06", null, 300);
    await clore(job, "2026-08-06", null, false, "Sophie va mal");
    expect((await ligne(job, "2026-08-06")).motif_echec, "treize caractères, et art. 9 dedans").toBe(
      "erreur_non_identifiee",
    );

    // Et un motif ABSENT se distingue d'un motif méconnu : deux diagnostics, deux mots.
    await reclamer(job, "2026-08-07", null, 300);
    await clore(job, "2026-08-07", null, false, null);
    expect((await ligne(job, "2026-08-07")).motif_echec).toBe("motif_inconnu");
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
    //
    // ⚠️ ON EXIGE UN REFUS DE PRIVILÈGE, pas « une erreur » (durci en 6.1a). La 6.1a change la
    // signature de `clore_execution` : un test qui se contentait de `error != null` serait resté vert
    // en recevant « fonction introuvable », c'est-à-dire en ne prouvant plus rien du tout sur les
    // privilèges. C'est la façon la plus discrète de perdre une garde — elle passe pour verte.
    const appels = [
      session.rpc("reclamer_execution", { p_job: "p", p_fenetre: "f", p_cible_id: null, p_bail_secondes: 1 }),
      session.rpc("clore_execution", {
        p_job: "p",
        p_fenetre: "f",
        p_cible_id: null,
        p_reussi: true,
        p_motif: null,
        p_jeton: "00000000-0000-4000-8000-000000000000",
      }),
      session.rpc("lever_incident", { p_type: "job_echoue", p_job: "p", p_detail: null }),
      session.rpc("code_reconnu", { p_texte: "x", p_max: 10 }),
      session.rpc("etat_ordonnanceur"),
      session.rpc("sante_ordonnanceur_publique"),
    ];
    for (const r of await Promise.all(appels)) {
      expect(r.error?.message ?? "", "RPC refusée sous JWT, POUR CAUSE DE PRIVILÈGE").toMatch(/permission denied/i);
    }
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
        // 6.1a. Un uuid opaque : il n'identifie pas une personne, il identifie une PRISE DE MAIN, et il
        // ne survit pas à la suivante. La liste reste ce qu'elle a toujours été — aucune colonne
        // capable d'accueillir du contenu.
        "jeton",
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// REVUE 4.9 / LOT B — les deux alarmes que la 4.9 avait cassées sans y toucher
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[T3-5] « la dernière réussite du job » veut de nouveau dire ça", () => {
  const job = `${P}-etat`;
  let cible = "";

  beforeAll(async () => {
    const { data } = await admin.auth.admin.createUser({
      email: `ordo-etat-${t}@exemple.fr`,
      password: MDP,
      email_confirm: true,
    });
    cible = data.user!.id;
  });
  afterAll(async () => {
    await admin.from("execution_job").delete().like("job", `${P}%`);
    if (cible) await admin.auth.admin.deleteUser(cible);
  });

  async function reussites(): Promise<Record<string, string>> {
    const { data, error } = await admin.rpc("etat_ordonnanceur");
    if (error) throw new Error(`etat_ordonnanceur: ${error.message}`);
    return (data as { reussites: Record<string, string> }).reussites;
  }

  it("[LE CŒUR] une personne servie ne fait plus passer le JOB pour à l'heure", async () => {
    // En 4.8, il existait exactement une ligne par (job, fenêtre), avec `cible_id = null` : agréger
    // `max(termine_le) group by job` était exact. La 4.9 écrit, sous le MÊME `job`, une ligne par
    // personne — si bien qu'une seule personne servie suffisait à faire répondre `false` à `estEnRetard`,
    // et `job_en_retard` n'était PLUS JAMAIS levé, quand bien même le fan-out échouerait depuis un mois.
    //
    // Mutation-cible : retirer `and cible_id is null` de l'agrégation.
    await reclamer(job, "2026-08-05", null, 300);
    await clore(job, "2026-08-05", null, false, "timeout"); // LE JOB a échoué…
    await reclamer(job, "2026-08-05", cible, 300);
    await clore(job, "2026-08-05", cible, true, null); // …mais une personne est passée

    expect(await reussites(), "le job n'a AUCUNE réussite : une personne n'est pas le job").not.toHaveProperty(job);
  });

  it("[CONTRÔLE POSITIF] quand le JOB réussit, il apparaît bien", async () => {
    // Sans lui, le test précédent serait satisfait par une fonction qui ne rend jamais rien.
    const autre = `${P}-etat-ok`;
    await reclamer(autre, "2026-08-06", null, 300);
    await clore(autre, "2026-08-06", null, true, null);
    expect(await reussites()).toHaveProperty(autre);
  });
});

describe("[AC5 / T3-6] l'homme mort, et le sens du mot « dégradé »", () => {
  /** Le nom que la migration 0028 code EN DUR dans la clause d'homme mort. */
  const JOB_SANTE = "sante-ordonnanceur";
  const FENETRE = `${P}-sante`;

  async function sante(): Promise<string> {
    const { data, error } = await admin.rpc("sante_ordonnanceur_publique");
    if (error) throw new Error(`sante: ${error.message}`);
    return data as string;
  }

  /** Une personne, pour la garde « une personne servie n'est pas le job » (6.1a). */
  let cible = "";
  beforeAll(async () => {
    const { data } = await admin.auth.admin.createUser({
      email: `ordo-sante-${t}@exemple.fr`,
      password: MDP,
      email_confirm: true,
    });
    cible = data.user!.id;
  });

  /**
   * Terrain net. Ces tests lisent une fonction GLOBALE — sans maîtriser son état d'entrée, ils
   * mesureraient ce que les tests voisins ont laissé. La purge est scopée : les lignes du job de santé
   * (que seul ce bloc écrit) et tout ce que ce fichier a préfixé.
   *
   * ⚠️ 6.1a : les exécutions préfixées aussi, désormais. Depuis que l'alarme peut S'ÉTEINDRE, une
   * ligne `reussi` laissée par un test voisin change le verdict du suivant — la boucle de fermeture
   * l'a rendu sensible à un état auquel il était jusque-là aveugle.
   */
  async function terrainNet() {
    await admin.from("execution_job").delete().eq("job", JOB_SANTE);
    await admin.from("execution_job").delete().like("job", `${P}%`);
    await admin.from("incident_systeme").delete().like("job", `${P}%`);
  }

  /** Une réussite datée du job de santé — c'est ce que la clause d'homme mort cherche. */
  async function reussiteSante() {
    const jeton = await reclamer(JOB_SANTE, FENETRE, null, 300);
    await clore(JOB_SANTE, FENETRE, null, true, null, jeton!);
  }

  beforeEach(terrainNet);
  afterAll(async () => {
    await terrainNet();
    if (cible) await admin.auth.admin.deleteUser(cible);
  });

  it("[LE CŒUR] sans réussite récente du job de santé, le signal public dit `degrade`", async () => {
    // LE DÉFAUT N°1 DE LA REVUE 4.8, et le plus retors : `sante_ordonnanceur_publique` ne regardait QUE
    // les incidents. Or les incidents sont écrits PAR l'ordonnanceur. Un ordonnanceur qui ne tourne plus
    // n'écrit plus rien — donc plus aucun incident, donc la sonde répondait « ok ». Et comme la fenêtre
    // des incidents ne fait que deux jours, le signal s'AMÉLIORAIT à mesure que la panne durait.
    //
    // Ce test vivait dans `ordonnanceur-endpoint.test.ts`. Il en a été retiré par la revue 4.9 : ce
    // fichier-là double désormais le registre (T4-3), si bien que sa précondition portait sur un nom de
    // job doublé alors que la clause SQL code le VRAI nom en dur — elle ne prouvait plus rien.
    // Mutation-cible : retirer la clause `not exists (… sante-ordonnanceur … 48 hours)`.
    expect(await sante(), "un ordonnanceur qui ne tourne pas ne se déclare pas sain").toBe("degrade");
  });

  it("[CONTRÔLE POSITIF] une réussite récente rouvre le droit de se dire sain", async () => {
    // Sans lui, la garde ci-dessus serait satisfaite par une fonction qui répond `degrade` en toutes
    // circonstances — un signal tout aussi inutile, à l'envers.
    await reussiteSante();
    expect(await sante()).toBe("ok");
  });

  it("[LE CŒUR / T3-6] un `job_echoue` — une panne de FOURNISSEUR — ne dégrade plus la sonde", async () => {
    // La clause d'origine regardait TOUT `incident_systeme` du jour, sans filtre sur le type. En 4.8 seul
    // le job de santé y écrivait, donc `degrade` disait bien « l'ordonnanceur est en difficulté ».
    // Depuis la 4.9, un lot de synthèses entièrement en échec y écrit aussi : Mistral tombe une heure à
    // 06 h, et `/api/health` — route PUBLIQUE — répond `degrade` pendant DEUX JOURS pleins, longtemps
    // après le retour du fournisseur, alors que l'ordonnanceur va parfaitement bien. Le mot avait changé
    // de sens sans que la SQL, son commentaire ni son test ne bougent.
    //
    // Rien n'est perdu : un job qui échoue tous les jours cesse d'avoir des réussites, donc `estEnRetard`
    // finit par le voir et lève `job_en_retard`. La panne durable remonte, le hoquet non — et c'est la
    // couche du dessous qui fait ce tri, à sa place.
    // Mutation-cible : retirer `and type = 'job_en_retard'`.
    await reussiteSante();
    await admin.rpc("lever_incident", { p_type: "job_echoue", p_job: `${P}-fournisseur`, p_detail: "lot" });
    expect(await sante(), "un travail qui rate n'est pas un ordonnanceur qui va mal").toBe("ok");
  });

  it("[CONTRÔLE POSITIF] un `job_en_retard`, lui, dégrade — c'est bien l'ordonnanceur qui parle", async () => {
    await reussiteSante();
    await admin.rpc("lever_incident", { p_type: "job_en_retard", p_job: `${P}-arrete`, p_detail: "hors_tolerance" });
    expect(await sante(), "un travail qui ne se fait PLUS, si").toBe("degrade");
  });

  it("[6.1a/AC3 — LE CŒUR] l'alarme S'ÉTEINT dès que le job réparé repasse", async () => {
    // LE DÉFAUT. `lever_incident` fait `on conflict do nothing` et aucune migration ne supprime jamais
    // de ligne d'`incident_systeme` ; la sonde dégradait sur `jour >= today - 1`. Une fois l'alarme
    // levée, elle sonnait DEUX JOURS PLEINS, quoi qu'il arrive ensuite.
    //
    // Aggravant, et c'est ce qui le rend structurel : le job de santé est le PREMIER du registre et à
    // fenêtre quotidienne. Son verdict est rendu une fois par jour, au premier tick, AVANT que les
    // autres jobs n'aient tourné. Un moteur de rétention réparé à 6 h 05 laissait donc `/api/health`
    // en `degrade` jusqu'au SURLENDEMAIN — et pendant tout ce temps, impossible de distinguer la panne
    // réparée de la suivante. Une alarme qui ne peut pas s'éteindre finit par n'être plus lue.
    //
    // LA RÈGLE, en une phrase : une alarme s'éteint par une réussite POSTÉRIEURE à elle. Aucune
    // tolérance, aucun seuil, aucune valeur recopiée du registre — juste un ordre entre deux
    // horodatages, et il se recalcule à chaque appel (décision D1 : l'incident ne porte pas d'état).
    //
    // Mutation-cible : retirer le `not exists (… e.termine_le > i.cree_le)`.
    await reussiteSante();
    const casse = `${P}-repare`;
    await admin.rpc("lever_incident", { p_type: "job_en_retard", p_job: casse, p_detail: "hors_tolerance" });
    expect(await sante(), "précondition : l'alarme sonne").toBe("degrade");

    const jeton = (await reclamer(casse, `${P}-w`, null, 300))!;
    await clore(casse, `${P}-w`, null, true, null, jeton);
    expect(await sante(), "le job repasse : l'alarme se tait, sans attendre deux jours").toBe("ok");
  });

  it("[6.1a] une réussite ANTÉRIEURE à l'alarme ne l'éteint pas, et une réussite PAR PERSONNE non plus", async () => {
    // Les deux façons d'écrire cette boucle de fermeture trop généreusement, et elles ont chacune leur
    // précédent dans ce dépôt :
    //
    //   • ignorer l'ordre des horodatages (`exists (… statut = 'reussi')` tout court) : l'alarme
    //     serait éteinte par la réussite qui l'a PRÉCÉDÉE, donc dès sa naissance. Une alarme qui
    //     n'existe jamais.
    //   • oublier `cible_id is null` : c'est mot pour mot le défaut n°1 de la revue 4.9 (`0031`, §1).
    //     Une seule personne servie éteindrait l'alarme d'un fan-out mort depuis un mois.
    await reussiteSante();
    const job = `${P}-anterieure`;

    // Une réussite globale AVANT l'incident…
    const j1 = (await reclamer(job, `${P}-w1`, null, 300))!;
    await clore(job, `${P}-w1`, null, true, null, j1);
    await admin.rpc("lever_incident", { p_type: "job_en_retard", p_job: job, p_detail: "hors_tolerance" });
    expect(await sante(), "une réussite d'AVANT n'éteint rien").toBe("degrade");

    // … et une réussite PAR PERSONNE après lui.
    const j2 = (await reclamer(job, `${P}-w2`, cible, 300))!;
    await clore(job, `${P}-w2`, cible, true, null, j2);
    expect(await sante(), "une personne servie n'est pas le job (0031, §1)").toBe("degrade");
  });
});

describe("[6.1a/AC5] l'absence d'art. 9 devient STRUCTURELLE — le vocabulaire est fermé en base", () => {
  afterAll(async () => {
    await admin.from("execution_job").delete().like("job", `${P}forme%`);
    await admin.from("incident_systeme").delete().like("job", `${P}forme%`);
  });

  it("[LE CŒUR] la CONTRAINTE refuse une écriture directe — celle qui ne passe pas par la RPC", async () => {
    // ⚠️ LES DEUX DÉFENSES NE COUVRENT PAS LA MÊME CHOSE, et il faut les viser séparément (le piège de
    // la défense en profondeur). `code_reconnu` filtre ce qui passe par `clore_execution` et
    // `lever_incident` ; la contrainte ferme le chemin qui ne passe PAS par elles. Or `service_role`
    // détient les sept privilèges DML sur ces tables, et le moteur de rétention de l'Epic 6 écrira
    // sous `service_role`. Un `insert into execution_job` direct, par commodité, une fois : c'est
    // exactement comme ça qu'un verbatim finit dans une table système.
    //
    // Mutation-cible : retirer `execution_job_motif_forme` / `incident_systeme_detail_forme`.
    const direct = await admin.from("execution_job").insert({
      job: `${P}forme-direct`,
      fenetre: "f",
      statut: "echoue",
      bail_expire_le: new Date().toISOString(),
      motif_echec: "Sophie a dit qu'elle allait mal",
    });
    expect(direct.error?.message ?? "", "la table refuse une phrase").toMatch(/execution_job_motif_forme/);

    const incident = await admin
      .from("incident_systeme")
      .insert({ type: "job_echoue", job: `${P}forme-direct`, detail: "elle pleurait au téléphone" });
    expect(incident.error?.message ?? "").toMatch(/incident_systeme_detail_forme/);
  });

  it("[CONTRÔLE POSITIF] un vrai code passe par le même chemin direct", async () => {
    // Sans lui, la garde ci-dessus serait satisfaite par une contrainte qui refuse TOUT — et la
    // première panne réelle ne pourrait plus s'écrire nulle part.
    const ok = await admin.from("execution_job").insert({
      job: `${P}forme-ok`,
      fenetre: "f",
      statut: "echoue",
      bail_expire_le: new Date().toISOString(),
      motif_echec: "synthese_prete_timeout",
    });
    expect(ok.error, "un code interne passe").toBeNull();

    const rpc = await admin.from("incident_systeme").insert({
      type: "job_echoue",
      job: `${P}forme-ok`,
      detail: "reclamer_execution: 42501",
    });
    expect(rpc.error, "et un code de RPC aussi").toBeNull();
  });

  it("`code_reconnu` reconnaît les deux formes du produit et jette tout le reste", async () => {
    // Le miroir SQL de `lib/domain/code-erreur.ts`. Les deux doivent dire la même chose, sans quoi un
    // code légitime serait remplacé en base alors que le TypeScript l'a laissé passer — et on
    // chercherait longtemps.
    const cas: [string | null, string | null][] = [
      ["synthese_prete_timeout", "synthese_prete_timeout"],
      ["erreur_non_identifiee", "erreur_non_identifiee"],
      ["reclamer_execution: 42501", "reclamer_execution: 42501"],
      [null, null],
      ["", null],
      // ⚠️ L'exigence de DEUX segments n'est pas cosmétique : sans elle, un mot unique en minuscules —
      // c'est-à-dire un mot pris au verbatim d'une utilisatrice — passerait la garde.
      ["timeout", "erreur_non_identifiee"],
      ["angoisse", "erreur_non_identifiee"],
      ["Sophie va mal", "erreur_non_identifiee"],
      ["echec_pour_sophie@exemple.fr", "erreur_non_identifiee"],
      ["x".repeat(121), "erreur_non_identifiee"],
    ];
    for (const [entree, attendu] of cas) {
      const { data, error } = await admin.rpc("code_reconnu", { p_texte: entree, p_max: 120 });
      expect(error, `code_reconnu(${entree})`).toBeNull();
      expect(data, `code_reconnu(${JSON.stringify(entree)})`).toBe(attendu);
    }
  });

  it("`lever_incident` écrit `null` quand il n'a rien à dire, jamais la chaîne vide", async () => {
    // `left(coalesce(p_detail, ''), 200)` écrivait une CHAÎNE VIDE : une valeur qui ne veut rien dire,
    // qu'il aurait fallu tolérer dans la contrainte de forme — donc un trou d'exactement un mot dans
    // la garde qu'on vient de poser. `null` dit la même chose sans ouvrir de trou.
    await admin.rpc("lever_incident", { p_type: "job_echoue", p_job: `${P}forme-vide`, p_detail: null });
    const { data } = await admin
      .from("incident_systeme")
      .select("detail")
      .eq("job", `${P}forme-vide`)
      .single();
    expect((data as { detail: string | null }).detail).toBeNull();
  });

  it("[NFR-022] un `detail` non reconnu est remplacé et l'incident est quand même levé", async () => {
    // Comme pour le motif : la garde ne doit JAMAIS faire perdre l'alerte qu'elle protège. Un
    // `lever_incident` qui lèverait ferait tomber le job de santé sur la deuxième panne de la journée
    // — l'organe qui surveille les pannes, tué par une panne.
    const r = await admin.rpc("lever_incident", {
      p_type: "job_en_retard",
      p_job: `${P}forme-libre`,
      p_detail: "le lot a planté sur Sophie",
    });
    expect(r.error, "ne lève pas").toBeNull();
    const { data } = await admin
      .from("incident_systeme")
      .select("detail")
      .eq("job", `${P}forme-libre`)
      .single();
    expect((data as { detail: string | null }).detail).toBe("erreur_non_identifiee");
  });
});
