import { describe, it, expect, vi, beforeEach } from "vitest";
import { lieuxFrance } from "@/lib/astro/adapters/lieux-france";

/**
 * Story 5.3 (T7) — L'ÉCRITURE DE L'HEURE ET DU LIEU.
 *
 * ══ POURQUOI CE POINT D'ÉCRITURE MÉRITE PLUS DE TESTS QUE LES AUTRES ═════════════════════════════
 *
 * Il est IRRÉVERSIBLE. La migration 0039 rend `heure_naissance` et `lieu_*` write-once :
 * `null → valeur` permis, `valeur → autre valeur` refusé. Une heure mal validée n'est pas un bogue
 * qu'on corrige au prochain déploiement — c'est un ascendant faux, définitif, chez quelqu'un, et
 * qui a l'air juste. Les gardes de ce fichier sont donc écrites contre CE coût-là.
 *
 * Trois propriétés sont gardées, et chacune a son mode d'échec silencieux :
 *   1. les COORDONNÉES ne viennent jamais du client (sinon : n'importe qui grave n'importe quoi) ;
 *   2. UN SEUL `update` (sinon : un état à moitié écrit, et définitif) ;
 *   3. la CONFIRMATION est exigée côté serveur (sinon : la case n'est qu'une décoration).
 */

const update = vi.fn<(valeurs: Record<string, unknown>) => void>();
const redirect = vi.fn((chemin: string) => {
  // `next/navigation`.redirect lève par conception : on reproduit ce contrat.
  throw new Error(`REDIRECT:${chemin}`);
});

let utilisateur: { id: string } | null = { id: "u1" };
/** Ce que la base répond quand on lui demande si l'heure est déjà là. */
let heureDejaLa: string | null = null;
let erreurEcriture: { code: string } | null = null;
let erreurLecture: { code: string } | null = null;

vi.mock("next/navigation", () => ({ redirect: (c: string) => redirect(c) }));
vi.mock("@/lib/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: utilisateur } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { heure_naissance: heureDejaLa },
            error: erreurLecture,
          }),
        }),
      }),
      update: (valeurs: Record<string, unknown>) => {
        update(valeurs);
        return { eq: async () => ({ error: erreurEcriture }) };
      },
    }),
  }),
}));

const { enregistrerHeureEtLieu, chercherLieux } = await import("@/app/heure-naissance/actions");

/** Bordeaux — code INSEE réel, coordonnées réelles (référentiel officiel). */
const BORDEAUX = lieuxFrance().chercher("Bordeaux", 1)[0];

function formulaire(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

const VALIDE = { heure_naissance: "07:15", code_lieu: "33063", confirmation: "oui" };

async function appeler(champs: Record<string, string>) {
  try {
    return await enregistrerHeureEtLieu({ statut: "saisie" }, formulaire(champs));
  } catch (e) {
    return { statut: "redirige" as const, message: (e as Error).message };
  }
}

beforeEach(() => {
  update.mockClear();
  redirect.mockClear();
  utilisateur = { id: "u1" };
  heureDejaLa = null;
  erreurEcriture = null;
  erreurLecture = null;
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le chemin nominal
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T7 / AC4] le chemin nominal grave heure ET lieu", () => {
  it("[CONTRÔLE DU CONTRÔLE] le référentiel a bien répondu — sinon tout ce fichier est creux", () => {
    expect(BORDEAUX?.code).toBe("33063");
    expect(BORDEAUX.fuseau).toBe("Europe/Paris");
  });

  it("[LE CŒUR / P9] UN SEUL `update`, portant les cinq colonnes à la fois", () => {
    // Deux écritures produiraient un état à moitié valide et DÉFINITIF si la seconde échoue : une
    // heure gravée pour toujours sans le lieu qui la rend exploitable, et aucun moyen de réparer.
    return appeler(VALIDE).then((r) => {
      expect(r.statut).toBe("enregistre");
      expect(update, "l'écriture a été découpée en plusieurs fois").toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0]).toEqual({
        heure_naissance: "07:15:00",
        lieu_naissance: BORDEAUX.nom,
        lieu_latitude: BORDEAUX.latitude,
        lieu_longitude: BORDEAUX.longitude,
        lieu_fuseau: BORDEAUX.fuseau,
      });
    });
  });

  it("l'heure est normalisée en `HH:MM:SS` — le type SQL est `time`", async () => {
    await appeler({ ...VALIDE, heure_naissance: "23:59" });
    expect(update.mock.calls[0][0].heure_naissance).toBe("23:59:00");
    update.mockClear();
    await appeler({ ...VALIDE, heure_naissance: "23:59:30" });
    expect(update.mock.calls[0][0].heure_naissance).toBe("23:59:30");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les coordonnées ne viennent JAMAIS du client
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T7 / DUR] les coordonnées sont RE-RÉSOLUES côté serveur", () => {
  it("[LE MUTANT QUI COMPTE] une latitude postée est ignorée", async () => {
    // Mutation-cible : lire `lieu_latitude` depuis le formulaire. On graverait — de façon
    // IRRÉVERSIBLE — des coordonnées arbitraires dans une donnée de calcul céleste.
    await appeler({
      ...VALIDE,
      lieu_latitude: "0",
      lieu_longitude: "0",
      lieu_fuseau: "Pacific/Kiritimati",
      lieu_naissance: "Nulle part",
    });
    const ecrit = update.mock.calls[0][0];
    expect(ecrit.lieu_latitude, "une coordonnée postée a été gravée").toBe(BORDEAUX.latitude);
    expect(ecrit.lieu_longitude).toBe(BORDEAUX.longitude);
    expect(ecrit.lieu_fuseau).toBe("Europe/Paris");
    expect(ecrit.lieu_naissance).toBe(BORDEAUX.nom);
  });

  it("un code inconnu est REFUSÉ — jamais une commune approchante", async () => {
    // Un « à peu près » ici serait une naissance placée ailleurs sur Terre, gravée write-once.
    const r = await appeler({ ...VALIDE, code_lieu: "99999" });
    expect(r.statut).toBe("erreur");
    expect(update, "une écriture a eu lieu malgré un lieu introuvable").not.toHaveBeenCalled();
  });

  it("un code VIDE est refusé (le formulaire n'a pas encore de commune choisie)", async () => {
    const r = await appeler({ ...VALIDE, code_lieu: "" });
    expect(r.statut).toBe("erreur");
    expect(update).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La validation de l'heure
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T7] l'heure est validée, jamais « réparée »", () => {
  const mauvaises = ["7h15", "7:15", "", "25:00", "12:60", "07-15", "midi", "07:15:99:00"];

  it.each(mauvaises)("« %s » est refusée, et rien n'est écrit", async (heure) => {
    const r = await appeler({ ...VALIDE, heure_naissance: heure });
    expect(r.statut, `« ${heure} » a été acceptée`).toBe("erreur");
    expect(update).not.toHaveBeenCalled();
  });

  it("[PRÉSENCE AVANT ABSENCE] les heures VALIDES passent bien", async () => {
    // Sans ce contre-exemple, une validation qui refuserait tout passerait le bloc ci-dessus.
    for (const heure of ["00:00", "07:15", "23:59"]) {
      update.mockClear();
      const r = await appeler({ ...VALIDE, heure_naissance: heure });
      expect(r.statut, `« ${heure} » a été refusée à tort`).toBe("enregistre");
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC8 — la confirmation d'irréversibilité
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T7 / AC8/DUR] sans confirmation, rien n'est gravé", () => {
  it("la case décochée bloque l'écriture CÔTÉ SERVEUR", async () => {
    // Mutation-cible : retirer le contrôle et ne garder que le `required` HTML. Un formulaire posté
    // hors navigateur graverait alors une heure pour toujours, sans que personne n'ait rien confirmé.
    const sansCase = { heure_naissance: "07:15", code_lieu: "33063" };
    const r = await appeler(sansCase);
    expect(r.statut).toBe("erreur");
    expect(r.message).toMatch(/ne se modifie pas|une fois/i);
    expect(update).not.toHaveBeenCalled();
  });

  it("une valeur de case FANTAISISTE ne vaut pas confirmation", async () => {
    const r = await appeler({ ...VALIDE, confirmation: "peut-etre" });
    expect(r.statut).toBe("erreur");
    expect(update).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le write-once, dit avant d'être subi
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T7 / AC8] une heure DÉJÀ enregistrée est annoncée, pas subie", () => {
  it("le refus est explicite, et distinct d'une panne", async () => {
    // Sans ce contrôle, le trigger de 0039 renverrait une erreur Postgres qu'on afficherait comme
    // « Réessaie » — une invitation à se heurter au même mur, pour quelque chose d'irréversible par
    // construction. C'est le patron `REFUS_RAYONNEMENT` de la 4.7 : un refus n'est pas une panne.
    heureDejaLa = "07:15:00";
    const r = await appeler(VALIDE);
    expect(r.statut).toBe("erreur");
    expect(r.message).toMatch(/déjà enregistrée/i);
    expect(r.message, "on ne promet pas un réessai qui échouera").not.toMatch(/réessaie/i);
    expect(update).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Pannes et session
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T7 / NFR-022] les pannes ne disent rien de personnel", () => {
  it("une écriture refusée par la base rend un message NEUTRE", async () => {
    erreurEcriture = { code: "42501" };
    const r = await appeler(VALIDE);
    expect(r.statut).toBe("erreur");
    // Ni l'heure, ni la commune, ni les coordonnées ne doivent apparaître.
    expect(r.message).not.toMatch(/07:15|Bordeaux|44\.|-0\./);
  });

  it("une panne de LECTURE ne grave rien — on ne devine pas que la place est libre", async () => {
    erreurLecture = { code: "08006" };
    const r = await appeler(VALIDE);
    expect(r.statut).toBe("erreur");
    expect(update, "on a écrit sans savoir si l'heure était déjà là").not.toHaveBeenCalled();
  });

  it("sans session : redirection vers l'entrée, aucune écriture", async () => {
    utilisateur = null;
    const r = await appeler(VALIDE);
    expect(r).toEqual({ statut: "redirige", message: "REDIRECT:/entrer" });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("[T7] la recherche de lieu exige une session", () => {
  it("sans session, elle ne rend RIEN — le référentiel n'est pas un service public", async () => {
    utilisateur = null;
    expect(await chercherLieux("Bordeaux")).toEqual([]);
  });

  it("avec session, elle rend des lieux exploitables", async () => {
    const r = await chercherLieux("Bordeaux");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].code).toBe("33063");
    expect(r[0].fuseau).toBe("Europe/Paris");
  });
});
