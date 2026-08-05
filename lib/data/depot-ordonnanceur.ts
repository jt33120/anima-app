import "server-only";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import { avecDelai } from "@/lib/domain/delai";

/**
 * Story 4.8 — le dépôt de l'ordonnanceur. C'est l'UN des rares endroits légitimes où `service_role` est
 * employé (cf. l'avertissement de `supabase/admin.ts`) : les trois tables de l'ordonnanceur n'appartiennent
 * à aucune utilisatrice, aucune session ne doit jamais les voir, et elles sont en deny-by-default précisément
 * pour ça. On n'y touche jamais à du CONTENU — ni journal, ni faits, ni branches. AD-12 reste tenu.
 *
 * Les erreurs ne portent que le code Postgres, jamais un message qui pourrait avoir ramassé une valeur au
 * passage (NFR-022).
 */

export interface EtatOrdonnanceur {
  /** L'exécution la plus ancienne connue. `null` si l'ordonnanceur n'a jamais rien exécuté. */
  readonly naissance: Date | null;
  /** Dernière réussite par nom de job. */
  readonly reussites: ReadonlyMap<string, Date>;
}

export type TypeIncident = "job_en_retard" | "job_echoue";

export interface DepotOrdonnanceur {
  environnementDeclare(): Promise<string | null>;
  reclamer(job: string, fenetre: string, cibleId: string | null, bailSecondes: number): Promise<boolean>;
  clore(job: string, fenetre: string, cibleId: string | null, reussi: boolean, motif: string | null): Promise<void>;
  etat(): Promise<EtatOrdonnanceur>;
  leverIncident(type: TypeIncident, job: string, detail: string | null): Promise<void>;
}

export function creerDepotOrdonnanceur(): DepotOrdonnanceur {
  const supabase = createSupabaseAdminClient();

  return {
    async environnementDeclare(): Promise<string | null> {
      const { data, error } = await supabase.from("environnement").select("nom").maybeSingle();
      // On ne LÈVE pas : l'appelant a besoin de distinguer « la base dit X » de « je ne sais pas », et son
      // repli sur l'inconnu est le refus (AC3). Une exception ici ferait remonter l'ignorance comme une panne.
      if (error) return null;
      return data?.nom ?? null;
    },

    async reclamer(job, fenetre, cibleId, bailSecondes): Promise<boolean> {
      const { data, error } = await supabase.rpc("reclamer_execution", {
        p_job: job,
        p_fenetre: fenetre,
        p_cible_id: cibleId,
        p_bail_secondes: bailSecondes,
      });
      if (error) throw new Error(`reclamer_execution: ${error.code ?? "echec"}`);
      // La RPC renvoie déjà un booléen strict (`coalesce(…, false)`) ; le `=== true` est le second niveau,
      // au cas où PostgREST rendrait `null` sur un chemin qu'on n'a pas prévu. Dans le doute : NE PAS exécuter.
      return data === true;
    },

    async clore(job, fenetre, cibleId, reussi, motif): Promise<void> {
      const { error } = await supabase.rpc("clore_execution", {
        p_job: job,
        p_fenetre: fenetre,
        p_cible_id: cibleId,
        p_reussi: reussi,
        p_motif: motif,
      });
      if (error) throw new Error(`clore_execution: ${error.code ?? "echec"}`);
    },

    async etat(): Promise<EtatOrdonnanceur> {
      const { data, error } = await supabase.rpc("etat_ordonnanceur");
      if (error) throw new Error(`etat_ordonnanceur: ${error.code ?? "echec"}`);
      const brut = (data ?? {}) as { naissance?: string | null; reussites?: Record<string, string> };
      const reussites = new Map<string, Date>();
      for (const [job, quand] of Object.entries(brut.reussites ?? {})) reussites.set(job, new Date(quand));
      return { naissance: brut.naissance ? new Date(brut.naissance) : null, reussites };
    },

    async leverIncident(type, job, detail): Promise<void> {
      const { error } = await supabase.rpc("lever_incident", {
        p_type: type,
        p_job: job,
        p_detail: detail,
      });
      if (error) throw new Error(`lever_incident: ${error.code ?? "echec"}`);
    },
  };
}

/**
 * L'état AGRÉGÉ pour `/api/health` — un mot, jamais plus (voir `sante_ordonnanceur_publique`).
 * Une base injoignable ne dégrade pas le test de fumée : elle rend `inconnu`.
 */
export async function santePublique(): Promise<"ok" | "degrade" | "inconnu"> {
  try {
    // BORNÉ. Un `try/catch` n'attrape que des rejets — jamais une attente. Or la panne la plus banale d'une
    // base n'est pas l'erreur, c'est le silence : la requête ne revient pas. `/api/health` étant le test de
    // fumée du produit, une base muette y faisait pendre la route entière jusqu'à ce que la plateforme la
    // tue — la sonde censée dire « l'app répond » cessait donc de répondre (revue 4.8, défaut n°8).
    //
    // `Promise.resolve(…)` n'est pas décoratif : le constructeur de requête de PostgREST est un THENABLE,
    // pas une `Promise`. Il porte `then` mais ni `catch` ni `finally` — et `avecDelai` appelle `.finally`
    // pour désarmer son minuteur. Le lui passer nu lèverait un TypeError à chaque appel, que ce `catch`
    // avalerait en « inconnu » : la sonde resterait verte en ayant cessé de sonder.
    const { data, error } = await avecDelai(
      Promise.resolve(createSupabaseAdminClient().rpc("sante_ordonnanceur_publique")),
      2_000,
      "sante_publique_timeout",
    );
    if (error || (data !== "ok" && data !== "degrade")) return "inconnu";
    return data;
  } catch {
    return "inconnu";
  }
}
