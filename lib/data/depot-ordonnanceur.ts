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
  /**
   * Rend le JETON de propriété de la réclamation (Story 6.1a), ou `null` si quelqu'un d'autre détient
   * déjà cette fenêtre. Le jeton est à rendre tel quel à `clore` : lui seul y autorise.
   *
   * ⚠️ Le refus valait `false` jusqu'à la 6.1a ; il vaut `null`. Un appelant qui oublierait de tester
   * ne reçoit donc rien d'utilisable par accident — la même intention que le `=== true` d'avant, et
   * la même règle : **dans le doute, NE PAS exécuter.**
   */
  reclamer(job: string, fenetre: string, cibleId: string | null, bailSecondes: number): Promise<string | null>;
  /**
   * Rend `true` si la ligne a bien été close, `false` si la clôture a été REFUSÉE — fenêtre déjà
   * terminée, ou jeton périmé parce qu'une autre exécution a repris la main sur bail expiré.
   *
   * Un refus n'est pas une erreur : c'est un non-événement, et il ne lève pas. Mais il se DIT — voir
   * `executer.ts`. Sur un rejeu de purge (6.8), « la clôture a été refusée parce qu'un autre détenait
   * la fenêtre » est exactement la phrase qu'il faut pouvoir produire.
   */
  clore(
    job: string,
    fenetre: string,
    cibleId: string | null,
    reussi: boolean,
    motif: string | null,
    jeton: string,
  ): Promise<boolean>;
  etat(): Promise<EtatOrdonnanceur>;
  leverIncident(type: TypeIncident, job: string, detail: string | null): Promise<void>;
}

/**
 * Le délai au-delà duquel un appel de dépôt est considéré comme perdu (Story 6.1, AC10).
 *
 * ⚠️ **Une marge, même fonction du nombre de jobs, ne protège de RIEN contre un appel qui PEND.**
 * Elle provisionne du temps ; elle ne le reprend pas. Or la panne la plus banale d'une base n'est
 * pas l'erreur, c'est le silence : la requête ne revient pas. Un `try/catch` n'attrape que des
 * rejets, jamais une attente — le répartiteur se ferait alors tuer par la plateforme avant d'avoir
 * rien clos ni levé, laissant la ligne `en_cours` sous son bail. Un échec totalement muet.
 *
 * Ce défaut avait déjà été payé une fois, sur `santePublique` (revue 4.8, défaut n°8), et la
 * correction n'avait été appliquée QU'À CET ENDROIT-LÀ — les cinq appels ci-dessous sont restés nus
 * jusqu'à la 6.1. C'est le patron habituel : on répare l'instance, pas la classe.
 *
 * 3 s : très au-dessus d'un aller-retour réel (dizaines de ms), très en dessous du budget d'un job.
 * Le rôle de ce nombre est d'être trop grand pour un fonctionnement normal, et fini.
 */
const DELAI_DEPOT_MS = 3_000;

export function creerDepotOrdonnanceur(): DepotOrdonnanceur {
  const supabase = createSupabaseAdminClient();

  /**
   * ⚠️ `Promise.resolve(...)` n'est PAS décoratif, et l'oublier est une faute silencieuse : le
   * constructeur de requête de PostgREST est un **thenable**, pas une `Promise`. Il porte `then`
   * mais ni `catch` ni `finally` — et `avecDelai` appelle `.finally` pour désarmer son minuteur.
   * Le lui passer nu lève un `TypeError` à chaque appel. (Piège déjà payé au défaut n°8 de la
   * revue 4.8 ; la garde de source plus bas dans `tests/ordonnanceur-architecture.test.ts` interdit
   * désormais un `await supabase.rpc(` hors de cette enveloppe.)
   */
  const borne = <T>(requete: PromiseLike<T>, operation: string): Promise<T> =>
    avecDelai(Promise.resolve(requete), DELAI_DEPOT_MS, `${operation}_timeout`);

  return {
    async environnementDeclare(): Promise<string | null> {
      // On ne LÈVE pas : l'appelant a besoin de distinguer « la base dit X » de « je ne sais pas », et son
      // repli sur l'inconnu est le refus (AC3). Une exception ici ferait remonter l'ignorance comme une panne.
      //
      // ⚠️ LE `try` EST INDISSOCIABLE DU `borne(...)` (Story 6.1, corrigé en revue). Les quatre autres
      // méthodes lèvent déjà par contrat, et leur délai se contente de rejoindre ce contrat. Celle-ci
      // est la seule à promettre de ne jamais lever — et l'ajout du délai lui a fait rompre cette
      // promesse en silence : `verifierEnvironnement` ne rattrape rien, `executer.ts:40` non plus, la
      // route non plus. Une base MUETTE — précisément le cas que la borne existe pour traiter —
      // remontait donc en 500 au lieu du refus `base_muette` documenté.
      //
      // Le repli produisait alors PLUS de dégât que le chemin nominal : l'exact inverse d'AD-15.
      try {
        const { data, error } = await borne(
          supabase.from("environnement").select("nom").maybeSingle(),
          "environnement_declare",
        );
        if (error) return null;
        return data?.nom ?? null;
      } catch {
        // Délai dépassé, ou toute autre panne du transport : on ne sait pas où l'on est. C'est
        // exactement ce que `null` veut dire, et l'appelant en refusera d'exécuter.
        return null;
      }
    },

    async reclamer(job, fenetre, cibleId, bailSecondes): Promise<string | null> {
      const { data, error } = await borne(
        supabase.rpc("reclamer_execution", {
          p_job: job,
          p_fenetre: fenetre,
          p_cible_id: cibleId,
          p_bail_secondes: bailSecondes,
        }),
        "reclamer_execution",
      );
      if (error) throw new Error(`reclamer_execution: ${error.code ?? "echec"}`);
      // Un test de FORME, et pas `data ?? null` : la RPC rend un uuid ou `null`, mais si PostgREST
      // rendait autre chose sur un chemin qu'on n'a pas prévu, `data ?? null` le laisserait passer pour
      // un jeton. Ce que la 6.1a a changé, c'est le type du refus ; l'esprit du `=== true` d'avant est
      // intact — dans le doute, NE PAS exécuter.
      return typeof data === "string" && data.length > 0 ? data : null;
    },

    async clore(job, fenetre, cibleId, reussi, motif, jeton): Promise<boolean> {
      const { data, error } = await borne(
        supabase.rpc("clore_execution", {
          p_job: job,
          p_fenetre: fenetre,
          p_cible_id: cibleId,
          p_reussi: reussi,
          p_motif: motif,
          p_jeton: jeton,
        }),
        "clore_execution",
      );
      if (error) throw new Error(`clore_execution: ${error.code ?? "echec"}`);
      // ⚠️ `data === true` et NON `data !== false` : la clôture refusée est un non-événement, mais
      // « je n'ai pas compris la réponse » n'en est pas un. Les deux se rapportent pareil — l'appelant
      // dit qu'il n'a rien clos — et c'est le repli le moins affirmatif des deux.
      return data === true;
    },

    async etat(): Promise<EtatOrdonnanceur> {
      const { data, error } = await borne(supabase.rpc("etat_ordonnanceur"), "etat_ordonnanceur");
      if (error) throw new Error(`etat_ordonnanceur: ${error.code ?? "echec"}`);
      const brut = (data ?? {}) as { naissance?: string | null; reussites?: Record<string, string> };
      const reussites = new Map<string, Date>();
      for (const [job, quand] of Object.entries(brut.reussites ?? {})) reussites.set(job, new Date(quand));
      return { naissance: brut.naissance ? new Date(brut.naissance) : null, reussites };
    },

    async leverIncident(type, job, detail): Promise<void> {
      const { error } = await borne(
        supabase.rpc("lever_incident", {
          p_type: type,
          p_job: job,
          p_detail: detail,
        }),
        "lever_incident",
      );
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
