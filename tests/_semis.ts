import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * _semis.ts — SEMER UNE UTILISATRICE DANS TOUTES LES TABLES QUI LA NOMMENT.
 *
 * Partagé par `export-sql.test.ts` (Story 6.6) et `effacement-sql.test.ts` (Story 6.7), et il DOIT
 * l'être : les deux stories reposent sur la même exigence — qu'aucune table ne soit oubliée — et
 * deux semis parallèles auraient divergé au premier ajout de table. Ici, une table ajoutée demain
 * se sème en un seul endroit, et les deux gardes en profitent.
 *
 * ⚠️ UN SEMIS RATÉ LÈVE. Une insertion silencieusement échouée rendrait les deux gardes vraies POUR
 * RIEN : « aucune ligne d'autrui » et « plus aucune ligne » sont tous les deux vrais d'une table
 * vide. Chaque `poser` vérifie, et fait échouer le test à la première ligne qui ne s'écrit pas.
 */

export async function poser(
  admin: SupabaseClient,
  table: string,
  ligne: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin.from(table).insert(ligne).select().single();
  if (error) throw new Error(`semis ${table}: ${error.message}`);
  return data as Record<string, unknown>;
}

/**
 * Sème une ligne dans chacune des 31 tables qui portent une colonne la nommant. L'ordre suit les
 * clés étrangères ; le consentement passe en premier parce que le write-gate art. 9 borne la suite.
 */
export async function semerTout(admin: SupabaseClient, id: string, marqueur: string): Promise<void> {
  const { error: eNom } = await admin.from("utilisatrice").update({ prenom: marqueur }).eq("id", id);
  if (eNom) throw new Error(`semis utilisatrice: ${eNom.message}`);

  await poser(admin, "consentement", {
    utilisatrice_id: id,
    art9_accorde: true,
    ia_reconnue: true,
    cgu_acceptees: true,
  });

  const journal = await poser(admin, "entree_journal", {
    utilisatrice_id: id,
    role: "utilisatrice",
    contenu: `${marqueur} — ce que j'ai déposé`,
    cle_tour: `${marqueur}-tour`,
  });
  const branche = await poser(admin, "branche", {
    utilisatrice_id: id,
    extrait_source_id: journal.id,
    nom: `le déménagement ${marqueur}`,
  });
  const tirage = await poser(admin, "tirage", {
    utilisatrice_id: id,
    carte: "la-porte",
    graine: "0f1e2d3c",
    taille_jeu: 64,
  });

  await poser(admin, "branche_retour", {
    branche_id: branche.id,
    utilisatrice_id: id,
    entree_journal_id: journal.id,
    jour_paris: "2026-08-16",
  });
  await poser(admin, "fait_extrait", {
    utilisatrice_id: id,
    origine: "extrait",
    statut: "actif",
    cle_dedoublonnage: `${marqueur}-fait`,
    contenu: `${marqueur} aime la mer`,
    extrait_source_id: journal.id,
  });
  await poser(admin, "resume_glissant", { utilisatrice_id: id, contenu: `${marqueur} — le résumé` });
  await poser(admin, "synthese", {
    utilisatrice_id: id,
    periode_debut: "2026-08-01T00:00:00Z",
    periode_fin: "2026-08-08T00:00:00Z",
    contenu: `${marqueur} — la synthèse`,
  });
  await poser(admin, "intention", {
    utilisatrice_id: id,
    branche_id: branche.id,
    declencheur: `quand ${marqueur} rentre le soir`,
    action: `écrire une ligne ${marqueur}`,
  });
  await poser(admin, "signal_reconceptualisation", { utilisatrice_id: id, entree_journal_id: journal.id });
  await poser(admin, "theme_natal", {
    utilisatrice_id: id,
    empreinte_entrees: `${marqueur}-empreinte`,
    contenu: { marqueur },
  });
  await poser(admin, "enneagramme", { utilisatrice_id: id, type: 5, origine: "test" });
  await poser(admin, "enneagramme_hypothese", { utilisatrice_id: id, type: 4 });
  await poser(admin, "enneagramme_tentative", { utilisatrice_id: id, reponses: { e1a: 2, e1b: 1 } });
  await poser(admin, "lecture", {
    utilisatrice_id: id,
    tirage_id: tirage.id,
    reponse: `${marqueur} — ma réponse`,
    restitution: `${marqueur} — la restitution`,
    close_a: "2026-08-16T10:00:00Z",
  });
  await poser(admin, "seance", { utilisatrice_id: id, phase: "construire" });
  await poser(admin, "usage_ia", {
    utilisatrice_id: id,
    cle_idempotence: `${marqueur}-usage`,
    tier: "leger",
    modele: "test",
    tokens_entree: 10,
    tokens_sortie: 20,
  });
  await poser(admin, "episode_detresse", { utilisatrice_id: id, niveau_max: 2 });
  await poser(admin, "audit_securite", { utilisatrice_id: id, type: "semence", decision: "posee" });
  await poser(admin, "pause_rythme", { utilisatrice_id: id, seances: 6, minutes: 70 });
  await poser(admin, "invitation_integration", { utilisatrice_id: id });
  await poser(admin, "notification_envoyee", {
    utilisatrice_id: id,
    motif: "synthese_prete",
    cle: `${marqueur}`.slice(0, 40),
  });
  await poser(admin, "abonnement", {
    utilisatrice_id: id,
    etat: "actif",
    source_maj_le: new Date().toISOString(),
  });
  await poser(admin, "remboursement", { utilisatrice_id: id, motif: "garantie" });
  await poser(admin, "information_reconduction", { utilisatrice_id: id, echeance: "2026-12-01T00:00:00Z" });
  await poser(admin, "preference_socle", { utilisatrice_id: id, heure: 8 });
  await poser(admin, "preference_courriel", { utilisatrice_id: id });
  await poser(admin, "abonnement_poussee", {
    utilisatrice_id: id,
    endpoint: `https://fcm.googleapis.com/${marqueur}`,
    cle_p256dh: "P".repeat(88),
    cle_auth: "A".repeat(24),
  });

  // ── Les deux tables HORS EXPORT mais qui la nomment (Story 6.7) ───────────────────────────────
  await poser(admin, "art9_temoin", { utilisatrice_id: id, note: `${marqueur} — témoin` });
  await poser(admin, "execution_job", {
    job: `semis-${marqueur}`,
    fenetre: "2026-08-16",
    cible_id: id,
    statut: "reussi",
    bail_expire_le: new Date(Date.now() + 3_600_000).toISOString(),
  });
}

/**
 * ── DÉCLARER LA MAJORITÉ D'UNE FIXTURE (migration 0066) ────────────────────────────────────────
 *
 * Depuis 0066, `est_barre_minorite()` rend VRAI tant qu'une majorité n'est pas POSITIVEMENT
 * établie : une utilisatrice sans `date_naissance` est barrée des vingt-six policies d'écriture
 * art. 9. C'est le correctif d'un défaut critique — un compte qui sautait `/naissance` écrivait sa
 * vie intérieure dans une base art. 9.
 *
 * ⚠️ HUIT FICHIERS DE TEST ONT CASSÉ SUR CE CHANGEMENT, ET C'ÉTAIT LA BONNE NOUVELLE : leurs
 * fixtures créaient un compte sans date et écrivaient de l'art. 9 — c'est-à-dire qu'elles
 * exerçaient le trou sans le savoir. Elles disent maintenant ce qu'elles ont toujours voulu dire :
 * « une adulte qui a répondu à la question ».
 *
 * À appeler juste après `admin.auth.admin.createUser`, sauf quand le test éprouve précisément
 * l'absence de date (voir `majorite-non-declaree.test.ts`).
 */
export async function declarerMajorite(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await admin
    .from("utilisatrice")
    .update({ date_naissance: "1990-01-01" })
    .eq("id", id);
  if (error) throw new Error(`declarerMajorite(${id}): ${error.message}`);
}
