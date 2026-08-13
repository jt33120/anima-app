import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import type { ReponseItem, TypeEnneagramme } from "@/lib/domain/enneagramme";

/**
 * depot-enneagramme.ts — LES ÉCRITURES DU TYPE, DE LA TENTATIVE ET DE L'HYPOTHÈSE (Story 5.5, T6).
 *
 * ── SOUS LE JWT DE L'UTILISATRICE, JAMAIS `service_role` ───────────────────────────────────────
 *
 * Patron `depot-journal.ts`, pas `depot-seance.ts`. Le type, les réponses et le germe sont du
 * contenu art. 9 POSSÉDÉ par elle : `service_role` contournerait la RLS **et** le write-gate de
 * consentement, c'est-à-dire les deux gardes de 0049 (AD-12, AD-13). Le germe lui-même n'y échappe
 * pas — c'est une inférence d'Anam SUR ELLE, écrite sous son identité, sous la garde de détresse.
 *
 * ── ÉCRITURES DIRECTES, DEUX RPC, ET LA LIGNE QUI SÉPARE LES DEUX ──────────────────────────────
 *
 * `depot-intention.ts` passe TOUT par des RPC ; `depot-theme-natal.ts` et `depot-journal.ts`
 * écrivent en direct. Ce n'est pas une incohérence du dépôt, c'est une distinction : une RPC est
 * utile quand plusieurs lignes doivent bouger ENSEMBLE, jamais pour « mieux garder ».
 *
 * Elle ne garde d'ailleurs rien : `authenticated` détient les sept privilèges DML sur chaque table
 * de `public` (0041/0048), donc tout ce qu'une RPC refuserait, un POST REST direct l'obtiendrait.
 * Les gardes sont dans les `with check` de 0049, et nulle part ailleurs.
 *
 *   RPC  — `terminer_tentative_enneagramme` (le type entre, la tentative sort)
 *   RPC  — `accepter_hypothese_enneagramme` (la réponse et le type)
 *   direct — enregistrer une réponse, refuser, marquer « dite », effacer, déposer un germe.
 *
 * ── LE REFUS N'EST PAS UNE PANNE, ET UNE UPDATE BLOQUÉE NE LÈVE RIEN ──────────────────────────
 *
 * Les deux moitiés d'une policy échouent DIFFÉREMMENT, et le dépôt l'a mesuré en 0049 :
 *
 *   • `using` qui échoue      → la ligne est INVISIBLE → zéro ligne, **aucune erreur** ;
 *   • `with check` qui échoue → **erreur 42501**.
 *
 * On ne sait donc pas d'avance laquelle mordra. Chaque mutation rend un BOOLÉEN obtenu en RELISANT
 * ce qui a bougé (`.select()`), jamais un `error === null` — qui annoncerait « c'est enregistré » à
 * quelqu'un dont rien n'a été enregistré (leçon 4.9/T5).
 *
 * NFR-022 : ni le type, ni les réponses ne sont loggés ni portés par une erreur — seulement le code
 * Postgres.
 *
 * ⚠️ Ce fichier est balayé par `tests/socle-jamais-coupe.test.ts` : l'ennéagramme est gratuit à vie
 * (FR-055), et le registre commercial n'a rien à faire ici — commentaires compris.
 */

/** RLS : la ligne est invisible, ou le `with check` refuse. Les deux sont des REFUS, pas des pannes. */
const REFUS_RLS = "42501";
/** L'unique index partiel de 0049 : une seule hypothèse en attente à la fois. */
const CONFLIT_UNICITE = "23505";

export interface DepotEnneagramme {
  /**
   * Enregistre l'état des réponses. Rend l'identifiant de la tentative — celui qui remonte jusqu'à
   * la `key` du composant. Idempotent : la même réponse renvoyée deux fois écrit la même chose.
   */
  enregistrerReponses(args: { reponses: readonly ReponseItem[] }): Promise<string>;
  /** Conclut le test : le type entre, la tentative sort, MÊME transaction. `false` = rien n'a bougé. */
  terminerTentative(args: { type: TypeEnneagramme }): Promise<boolean>;
  /** Abandonne la passe en cours. `false` = il n'y en avait pas. Jamais gaté (c'est un retrait). */
  abandonnerTentative(): Promise<boolean>;
  /**
   * Sème le germe d'une hypothèse. `null` = REFUSÉ, et c'est un état normal : épisode de détresse
   * (AD-17), consentement absent, ou une hypothèse déjà en attente. Jamais une exception.
   */
  deposerHypothese(args: { type: TypeEnneagramme }): Promise<string | null>;
  /** La phrase a ATTEINT UN ÉCRAN. Appelé par le CLIENT, jamais par un rendu serveur (leçon 0045). */
  marquerHypotheseDite(args: { hypotheseId: string; maintenant: Date }): Promise<boolean>;
  /** Accepte CE QUI A ÉTÉ MONTRÉ : le type vient de la ligne, jamais de l'appelante. */
  accepterHypothese(args: { hypotheseId: string }): Promise<boolean>;
  /** Refuse. **Sans consentement requis** — le refus survit à la révocation (0049, AC6). */
  refuserHypothese(args: { hypotheseId: string }): Promise<boolean>;
  /** Retire l'étiquette. Franc, sans tombstone, et ouvert en toutes circonstances (FR-067). */
  effacerType(): Promise<boolean>;
}

/**
 * Les réponses en objet JSONB, tel que `reponses_enneagramme_valides` (0049) l'exige.
 *
 * Un item répondu DEUX FOIS ne garde que la DERNIÈRE — un formulaire qui laisse revenir en arrière
 * produit exactement ça, et c'est déjà la règle de `scorer` (`lib/domain/enneagramme.ts`). Les deux
 * doivent coïncider, sans quoi ce qui est marqué à l'écran et ce qui est scoré divergeraient.
 */
export function reponsesEnJson(reponses: readonly ReponseItem[]): Record<string, number> {
  return Object.fromEntries(reponses.map((r) => [r.itemId, r.niveau]));
}

export function creerDepotEnneagramme(utilisatriceId: string, client?: SupabaseClient): DepotEnneagramme {
  const clientOu = async () => client ?? (await createSupabaseServerClient());

  return {
    async enregistrerReponses({ reponses }): Promise<string> {
      const supabase = await clientOu();
      // `tentative_id` n'est PAS dans la charge utile : sur conflit, seul `reponses` est réécrit, et
      // l'identifiant de la passe SURVIT. L'y mettre le régénérerait à chaque réponse — donc
      // remonterait le composant à chaque clic, donc perdrait le focus à chaque clic.
      const { data, error } = await supabase
        .from("enneagramme_tentative")
        .upsert(
          { utilisatrice_id: utilisatriceId, reponses: reponsesEnJson(reponses) },
          { onConflict: "utilisatrice_id" },
        )
        .select("tentative_id")
        .maybeSingle<{ tentative_id: string }>();

      if (error) throw new Error(`enneagramme.enregistrerReponses: ${error.code ?? "echec"}`);
      // Une écriture qui n'a rien relu alors qu'elle n'a pas levé serait un succès fantôme : on
      // refuse de le propager. L'appelant n'aurait aucun identifiant de passe à poser en `key`.
      if (!data) throw new Error("enneagramme.enregistrerReponses: sans_tentative");
      return data.tentative_id;
    },

    async terminerTentative({ type }): Promise<boolean> {
      const supabase = await clientOu();
      const { data, error } = await supabase.rpc("terminer_tentative_enneagramme", { p_type: type });
      if (error) throw new Error(`enneagramme.terminerTentative: ${error.code ?? "echec"}`);
      return data === true;
    },

    async abandonnerTentative(): Promise<boolean> {
      const supabase = await clientOu();
      const { data, error } = await supabase
        .from("enneagramme_tentative")
        .delete()
        .eq("utilisatrice_id", utilisatriceId)
        .select("tentative_id");
      if (error) throw new Error(`enneagramme.abandonnerTentative: ${error.code ?? "echec"}`);
      return (data ?? []).length > 0;
    },

    async deposerHypothese({ type }): Promise<string | null> {
      const supabase = await clientOu();
      const { data, error } = await supabase
        .from("enneagramme_hypothese")
        .insert({ utilisatrice_id: utilisatriceId, type })
        .select("id")
        .maybeSingle<{ id: string }>();

      // ⚠️ DEUX CODES SONT DES RÉPONSES, PAS DES PANNES, et les avaler est une décision :
      //   • 42501 — la policy refuse. C'est la garde de détresse d'AD-17 qui fonctionne, ou le
      //     consentement absent. L'étage `after()` qui sème le germe ne doit pas mourir de ça.
      //   • 23505 — l'index partiel de 0049 : il y a déjà une hypothèse en attente. C'est
      //     précisément ce que l'index existe pour empêcher, puisque `after()` peut s'exécuter deux
      //     fois (il ne consulte jamais `request.signal.aborted`).
      // Tout le reste LÈVE : avaler large ferait passer une panne pour un refus, et Anam se tairait
      // sans que personne ne le sache.
      if (error) {
        if (error.code === REFUS_RLS || error.code === CONFLIT_UNICITE) return null;
        throw new Error(`enneagramme.deposerHypothese: ${error.code ?? "echec"}`);
      }
      return data?.id ?? null;
    },

    async marquerHypotheseDite({ hypotheseId, maintenant }): Promise<boolean> {
      const supabase = await clientOu();
      // `is("dite_le", null)` porte l'idempotence : deux onglets qui affichent la phrase à la même
      // seconde ne la dépensent qu'une fois, et le trigger de 0049 refuserait de toute façon de la
      // réécrire. Seule la NULLITÉ de cette colonne est porteuse — la valeur ne décide de rien, ce
      // qui rend l'horloge de l'appelant sans conséquence.
      const { data, error } = await supabase
        .from("enneagramme_hypothese")
        .update({ dite_le: maintenant.toISOString() })
        .eq("id", hypotheseId)
        .eq("statut", "en_attente")
        .is("dite_le", null)
        .select("id");
      if (error) throw new Error(`enneagramme.marquerHypotheseDite: ${error.code ?? "echec"}`);
      return (data ?? []).length > 0;
    },

    async accepterHypothese({ hypotheseId }): Promise<boolean> {
      const supabase = await clientOu();
      const { data, error } = await supabase.rpc("accepter_hypothese_enneagramme", {
        p_hypothese: hypotheseId,
      });
      if (error) throw new Error(`enneagramme.accepterHypothese: ${error.code ?? "echec"}`);
      return data === true;
    },

    async refuserHypothese({ hypotheseId }): Promise<boolean> {
      const supabase = await clientOu();
      // AUCUNE RPC ici, et c'est le miroir exact d'`accepterHypothese` : refuser ne touche qu'une
      // table, donc n'a rien à rendre atomique. Le `statut = 'en_attente'` est ce qui rend le geste
      // idempotent — une hypothèse déjà répondue rend zéro ligne, et le trigger anti-résurrection
      // de 0049 refuserait la transition de toute façon.
      const { data, error } = await supabase
        .from("enneagramme_hypothese")
        .update({ statut: "refusee" })
        .eq("id", hypotheseId)
        .eq("statut", "en_attente")
        .select("id");
      if (error) throw new Error(`enneagramme.refuserHypothese: ${error.code ?? "echec"}`);
      return (data ?? []).length > 0;
    },

    async effacerType(): Promise<boolean> {
      const supabase = await clientOu();
      const { data, error } = await supabase
        .from("enneagramme")
        .delete()
        .eq("utilisatrice_id", utilisatriceId)
        .select("utilisatrice_id");
      if (error) throw new Error(`enneagramme.effacerType: ${error.code ?? "echec"}`);
      return (data ?? []).length > 0;
    },
  };
}
