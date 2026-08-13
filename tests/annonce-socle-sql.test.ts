import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Story 5.3 (T8) — LA MENTION UNIQUE, CONTRE LE VRAI SQL (migration 0040, AC4).
 *
 * ══ POURQUOI CE FICHIER FRAPPE LA BASE ═══════════════════════════════════════════════════════════
 *
 * « Anam le mentionne UNE SEULE FOIS » est une propriété de CONCURRENCE, et aucune propriété de
 * concurrence ne se prouve dans du TypeScript doublé. Deux onglets ouverts au même instant, c'est
 * deux transactions réelles sur une vraie ligne — la seule question qui compte est de savoir
 * laquelle des deux gagne, et si l'autre le sait.
 *
 * C'est aussi la raison d'être du verrou consultatif (`pg_advisory_xact_lock`, sel 4911) : sans lui,
 * deux `update ... where socle_complete_annonce_le is null` concurrents peuvent tous deux voir
 * `null` et tous deux écrire.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const t = Date.now();

async function creerUtilisatrice(suffixe: string): Promise<{ id: string; client: SupabaseClient }> {
  const email = `ann-${suffixe}-${t}@exemple.fr`;
  const motDePasse = "test-ann-123!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = data.user!.id;
  const { error: e2 } = await admin
    .from("utilisatrice")
    .update({ date_naissance: "1990-06-15" })
    .eq("id", id);
  if (e2) throw new Error(`date_naissance: ${e2.message}`);
  const client = createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: e3 } = await client.auth.signInWithPassword({ email, password: motDePasse });
  if (e3) throw new Error(`signIn: ${e3.message}`);
  return { id, client };
}

/** L'état COMPLET attendu par la RPC : heure enregistrée + thème recalculé (version ≥ 2). */
async function rendreEligible(id: string): Promise<void> {
  const { error: e1 } = await admin
    .from("utilisatrice")
    .update({
      heure_naissance: "07:15:00",
      lieu_naissance: "Bordeaux",
      lieu_latitude: 44.84,
      lieu_longitude: -0.58,
      lieu_fuseau: "Europe/Paris",
    })
    .eq("id", id);
  if (e1) throw new Error(`heure: ${e1.message}`);

  await admin
    .from("consentement")
    .upsert(
      { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true },
      { onConflict: "utilisatrice_id" },
    );
  const contenu = { schema: 2, adaptateur: "test", positions: [], absents: [], angles: {}, precision: "heure_connue" };
  const { error: e2 } = await admin
    .from("theme_natal")
    .insert({ utilisatrice_id: id, empreinte_entrees: "avant", contenu });
  if (e2) throw new Error(`theme insert: ${e2.message}`);
  // Le recalcul : version + 1 ET empreinte différente (le trigger de 0039 exige les deux).
  const { error: e3 } = await admin
    .from("theme_natal")
    .update({ version: 2, empreinte_entrees: "apres", contenu })
    .eq("utilisatrice_id", id);
  if (e3) throw new Error(`theme recalcul: ${e3.message}`);
}

/**
 * ⚠️ DEUX TEMPS DEPUIS LA REVUE DU 2026-08-12 (B3, migration 0045).
 *
 * `reserver_annonce_socle_complet()` lisait ET dépensait d'un seul geste, et elle était appelée
 * depuis un rendu serveur — donc la mention se consommait même rendue dans une région `inert` que
 * personne ne voit. Elle est remplacée par `annonce_socle_due()` (lecture seule) et
 * `marquer_annonce_socle_dite()` (l'écriture, déclenchée quand la phrase atteint l'écran).
 *
 * `reserver` conserve son nom et son contrat — « est-ce dû, et je le consomme » — pour que tous les
 * cas de ce fichier restent lisibles : ce sont les mêmes invariants, sur un protocole en deux temps.
 */
const due = async (client: SupabaseClient) => {
  const { data, error } = await client.rpc("annonce_socle_due");
  if (error) throw new Error(`rpc due: ${error.message}`);
  return data;
};

const marquer = async (client: SupabaseClient) => {
  const { data, error } = await client.rpc("marquer_annonce_socle_dite");
  if (error) throw new Error(`rpc marquer: ${error.message}`);
  return data;
};

const reserver = async (client: SupabaseClient) => {
  if (!(await due(client))) return false;
  return await marquer(client);
};

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC4 — une seule fois
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.3 / AC4 DUR] la mention de complétion — vraie AU PLUS UNE FOIS", () => {
  let u: Awaited<ReturnType<typeof creerUtilisatrice>>;

  beforeAll(async () => {
    u = await creerUtilisatrice("unique");
  });
  afterAll(async () => {
    if (u?.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("[PRÉSENCE AVANT ABSENCE] sans heure de naissance, elle se tait", async () => {
    // Condition de validité du test suivant : si la RPC rendait toujours `false`, « une seule
    // fois » serait vrai pour une mauvaise raison.
    expect(await reserver(u.client)).toBe(false);
  });

  it("le thème NON recalculé (version 1) ne déclenche rien", async () => {
    // Le jour où l'onboarding demandera l'heure dès l'inscription, le thème sera calculé UNE fois
    // avec elle. Anam annoncerait alors « j'ai repris ton thème » à quelqu'un dont le thème n'a
    // jamais été repris. La version dit exactement ce qu'on veut savoir.
    await admin
      .from("utilisatrice")
      .update({
        heure_naissance: "07:15:00",
        lieu_naissance: "Bordeaux",
        lieu_latitude: 44.84,
        lieu_longitude: -0.58,
        lieu_fuseau: "Europe/Paris",
      })
      .eq("id", u.id);
    await admin
      .from("consentement")
      .upsert(
        { utilisatrice_id: u.id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true },
        { onConflict: "utilisatrice_id" },
      );
    await admin.from("theme_natal").insert({
      utilisatrice_id: u.id,
      empreinte_entrees: "v1",
      contenu: { schema: 2, adaptateur: "test", positions: [], absents: [] },
    });
    expect(await reserver(u.client)).toBe(false);
  });

  it("[LE CŒUR] après recalcul : VRAI une fois, puis FAUX pour toujours", async () => {
    await admin
      .from("theme_natal")
      .update({ version: 2, empreinte_entrees: "v2", contenu: { schema: 2, adaptateur: "t", positions: [], absents: [] } })
      .eq("utilisatrice_id", u.id);

    expect(await reserver(u.client), "la mention n'est jamais partie").toBe(true);
    expect(await reserver(u.client), "elle est repartie une deuxième fois").toBe(false);
    expect(await reserver(u.client)).toBe(false);

    const { data } = await admin
      .from("utilisatrice")
      .select("socle_complete_annonce_le")
      .eq("id", u.id)
      .single();
    expect(data?.socle_complete_annonce_le, "le marqueur n'a pas été posé").not.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La concurrence — deux onglets
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.3 / AC4 DUR] deux appels CONCURRENTS ne peuvent pas la dire deux fois", () => {
  it("un seul `true` sur dix appels lancés ensemble", async () => {
    // Sans le verrou consultatif, dix `update … where … is null` partis ensemble peuvent tous voir
    // `null` et tous écrire. C'est le scénario « deux onglets ouverts », et il est réel : la scène
    // se recharge à chaque entrée dans la région arbre.
    const u = await creerUtilisatrice("concurrent");
    try {
      await rendreEligible(u.id);
      const resultats = await Promise.all(Array.from({ length: 10 }, () => reserver(u.client)));
      expect(resultats.filter((r) => r === true), `réservations gagnantes : ${resultats}`).toHaveLength(1);
    } finally {
      await admin.auth.admin.deleteUser(u.id);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AD-17 — rien ne se superpose à un épisode de détresse
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.3 / AD-17 DUR] pendant un épisode, la mention se TAIT — et n'est pas perdue", () => {
  it("elle attend la fin de la fenêtre, puis sort", async () => {
    // La distinction est tout l'intérêt d'un marqueur posé À LA PAROLE et non au recalcul : se
    // taire ne consomme rien. Rien ne se superpose à un épisode, pas même une bonne nouvelle — et
    // rien n'est perdu pour autant.
    const u = await creerUtilisatrice("detresse");
    try {
      await rendreEligible(u.id);

      const { error } = await admin
        .from("episode_detresse")
        .insert({ utilisatrice_id: u.id, niveau_max: 2 });
      expect(error, "l'épisode n'a pas pu être créé — le test ne prouverait rien").toBeNull();
      expect(await reserver(u.client), "Anam a parlé pendant un épisode de détresse").toBe(false);

      // Le marqueur doit être resté VIERGE : sinon la mention serait perdue pour toujours.
      const { data } = await admin
        .from("utilisatrice")
        .select("socle_complete_annonce_le")
        .eq("id", u.id)
        .single();
      expect(data?.socle_complete_annonce_le, "la mention a été consommée en silence").toBeNull();

      // L'épisode se referme (fin posée et fenêtre expirée) → elle reprend la parole.
      //
      // ⚠️ L'ERREUR DE CET `update` EST ASSÉRÉE, et ce n'est pas du zèle : la première version
      // posait `fin` à 96 h dans le PASSÉ, ce qui viole `episode_fin_apres_debut` (fin >= debut,
      // et l'épisode venait d'être créé). PostgREST refusait l'écriture, l'épisode restait ouvert,
      // et le test échouait en accusant le code — alors que le défaut était dans sa mise en scène.
      const { error: eFin } = await admin
        .from("episode_detresse")
        .update({
          fin: new Date().toISOString(),
          fenetre_expire_at: new Date(Date.now() - 3600_000).toISOString(),
        })
        .eq("utilisatrice_id", u.id);
      expect(eFin, "l'épisode n'a pas pu être refermé — le test ne prouverait rien").toBeNull();
      expect(await reserver(u.client), "la mention a été perdue au lieu d'être différée").toBe(true);
    } finally {
      await admin.auth.admin.deleteUser(u.id);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Cloisonnement & droits
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.3 / AD-12] la réservation ne parle que de SA propre ligne", () => {
  it("l'appel d'une utilisatrice ne consomme pas la mention d'une autre", async () => {
    const a = await creerUtilisatrice("cloison-a");
    const b = await creerUtilisatrice("cloison-b");
    try {
      await rendreEligible(a.id);
      await rendreEligible(b.id);

      expect(await reserver(a.client)).toBe(true);
      // B n'a rien dit, et A ne peut pas avoir parlé pour elle.
      const { data } = await admin
        .from("utilisatrice")
        .select("socle_complete_annonce_le")
        .eq("id", b.id)
        .single();
      expect(data?.socle_complete_annonce_le, "la mention d'une autre a été consommée").toBeNull();
      expect(await reserver(b.client)).toBe(true);
    } finally {
      await admin.auth.admin.deleteUser(a.id);
      await admin.auth.admin.deleteUser(b.id);
    }
  });
});

describe("[5.3] la migration 0040 dit ce qu'elle fait", () => {
  const migration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/0040_completion_socle.sql"),
    "utf-8",
  );

  const m45 = readFileSync(
    resolve(process.cwd(), "supabase/migrations/0045_annonce_socle_dite_pas_servie.sql"),
    "utf-8",
  );

  it("[CONTRÔLE DU CONTRÔLE] les migrations sont bien lues", () => {
    expect(migration.length).toBeGreaterThan(2000);
    expect(m45.length).toBeGreaterThan(2000);
    expect(m45).toContain("create function public.annonce_socle_due");
    expect(m45).toContain("create function public.marquer_annonce_socle_dite");
  });

  it("[B3] l'ancienne porte à un temps est SUPPRIMÉE, pas laissée « au cas où »", () => {
    // Deux chemins vers la même décision, dont l'un dépense à la lecture, c'est la garantie qu'un
    // appelant futur reprendra le mauvais — et que B3 revient sans que personne ne l'ait décidé.
    expect(m45).toContain("drop function public.reserver_annonce_socle_complet()");
  });

  it("aucune des deux RPC n'est exécutable par `public` ni par `anon`", () => {
    for (const nom of ["annonce_socle_due", "marquer_annonce_socle_dite"]) {
      expect(m45).toMatch(new RegExp(`revoke execute on function public\\.${nom}\\(\\) from public, anon`));
      expect(m45).toMatch(new RegExp(`grant\\s+execute on function public\\.${nom}\\(\\) to authenticated`));
    }
  });

  it("elle porte son propre sel de verrou — jamais celui d'un autre mécanisme", () => {
    // Quatre espaces de verrous (4909 notifications, 4910 invitation, 0014 Stripe, 4911 ici) qui ne
    // doivent pas s'attendre l'un l'autre : un sel partagé transformerait deux mécanismes
    // indépendants en file d'attente commune.
    expect(migration).toContain("4911");
    for (const autre of ["4909", "4910"]) {
      expect(migration.match(new RegExp(`hashtextextended\\([^)]*${autre}`)), `sel ${autre} réutilisé`).toBeNull();
    }
  });

  it("la garde de détresse est en SQL, pas chez l'appelant", () => {
    // Une garde AD-17 posée dans du TypeScript est une garde qu'un second appelant peut oublier.
    expect(migration).toContain("public.branche_bloquee_par_detresse()");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// B3 (revue du 2026-08-12) — LIRE NE DÉPENSE PLUS
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[B3] la mention se dépense quand elle est DITE, jamais quand elle est servie", () => {
  let u: Awaited<ReturnType<typeof creerUtilisatrice>>;

  beforeAll(async () => {
    u = await creerUtilisatrice("b3");
    await rendreEligible(u.id);
  }, 60_000);

  afterAll(async () => {
    if (u?.id) await admin.auth.admin.deleteUser(u.id);
  }, 60_000);

  it("[LE TEST QUI COMPTE] dix lectures d'affilée ne consomment RIEN", async () => {
    // C'est exactement ce que faisait le produit : `chargerOuverture()` part d'`app/page.tsx`, donc
    // à chaque rendu serveur de la scène. Chaque navigation, chaque `router.refresh()`, chaque
    // rechargement. Avec l'ancienne RPC, le PREMIER de ces rendus dépensait la mention — y compris
    // lorsqu'il la plaçait dans une région `inert` que personne ne voit et qu'aucun lecteur
    // d'écran n'annonce. Un rechargement avant d'ouvrir la conversation, et la phrase était perdue
    // à vie, sans trace et sans recours.
    for (let i = 0; i < 10; i++) {
      expect(await due(u.client), `la lecture n°${i + 1} a dépensé la mention`).toBe(true);
    }
  });

  it("puis UN marquage la pose, et la lecture bascule pour toujours", async () => {
    expect(await marquer(u.client)).toBe(true);
    expect(await due(u.client)).toBe(false);
  });

  it("un second marquage ne repose rien (idempotent, deux onglets)", async () => {
    expect(await marquer(u.client), "la date ne se réécrit pas").toBe(false);
  });

  it("[CONTRÔLE] la colonne porte bien une date après le marquage", async () => {
    // Sans ce témoin, « la lecture dit false » serait vrai d'une lecture cassée plutôt que d'une
    // mention réellement dite.
    const { data } = await admin
      .from("utilisatrice")
      .select("socle_complete_annonce_le")
      .eq("id", u.id)
      .maybeSingle<{ socle_complete_annonce_le: string | null }>();
    expect(data?.socle_complete_annonce_le).toBeTruthy();
  });
});

describe("[B3/DUR] le marquage RÉAFFIRME toutes les conditions — il ne fait pas confiance à l'appelant", () => {
  let u: Awaited<ReturnType<typeof creerUtilisatrice>>;

  beforeAll(async () => {
    u = await creerUtilisatrice("b3-direct");
  }, 60_000);

  afterAll(async () => {
    if (u?.id) await admin.auth.admin.deleteUser(u.id);
  }, 60_000);

  it("sans heure de naissance, un appel DIRECT au marquage ne brûle pas la mention", async () => {
    // `authenticated` a le grant d'exécution : un POST direct sur `/rest/v1/rpc/` est à la portée de
    // n'importe qui sous son propre jeton. Si les conditions ne vivaient que dans la lecture — ou
    // pire, dans le TypeScript qui l'appelle — on pourrait se priver de sa propre phrase avant même
    // qu'elle ne soit due. C'est la leçon centrale de cette revue, appliquée au plus petit enjeu du
    // dépôt : une garde qui n'est pas dans la fonction n'existe pas.
    expect(await marquer(u.client)).toBe(false);
    const { data } = await admin
      .from("utilisatrice")
      .select("socle_complete_annonce_le")
      .eq("id", u.id)
      .maybeSingle<{ socle_complete_annonce_le: string | null }>();
    expect(data?.socle_complete_annonce_le, "la mention a été brûlée avant d'être due").toBeNull();

    // Et elle reste due une fois le socle complété : rien n'a été consommé.
    await rendreEligible(u.id);
    expect(await due(u.client)).toBe(true);
  });
});
