import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estAffichable, type FaitRetenu } from "@/lib/domain/memoire-retenue";

/**
 * lire-memoire.ts — LA LECTURE DE « CE QU'ANAM RETIENT » (Story 6.5, T3 ; AC1/AC5).
 *
 * ── SOUS LE JWT, JAMAIS `service_role` ─────────────────────────────────────────────────────────
 *
 * La policy `fait_extrait_lecture` (0018) est ce qui garantit qu'on ne lit que les siens — pas une
 * condition écrite ici, qu'un refactor pourrait perdre (AD-12). C'est la règle du projet pour tout
 * contenu applicatif.
 *
 * ── ⚠️ TOUT PASSE PAR UNE FONCTION POSSÉDÉE, ET UNE GARDE A DÛ ME LE RAPPELER ─────────────────
 *
 * La première version de ce fichier écrivait `.from("fait_extrait")`. `faits-architecture.test.ts`
 * a rougi, et elle avait raison : le dépôt exige que le littéral de cette table n'apparaisse NULLE
 * PART dans le code applicatif — `fusionner_fait_extrait` pour l'écriture (4.2),
 * `charger_faits_rappelables` pour la lecture du rappel (4.3), et maintenant `charger_faits_retenus`
 * pour celle de l'écran. Sur une table art. 9, ce que ça achète est concret : la FORME de ce qui
 * sort est décidée en un seul endroit auditable, et aucun appelant ne peut écrire `select("*")`.
 *
 * ── L'EXTRAIT SOURCE VIENT AVEC, ET C'EST UNE DÉCISION (D5) ────────────────────────────────────
 *
 * L'AC1 demande « un lien vers l'extrait source ». Il n'existe aucune ancre par message dans la
 * conversation, et la leçon de la 4.10 est écrite noir sur blanc : une question sans issue est un
 * reproche — un lien qui ne mène nulle part en est un aussi. Le message d'origine descend donc avec
 * le fait, et l'écran le replie dans un `<details>`.
 *
 * La jointure vit dans la fonction, en `security invoker` : la RLS d'`entree_journal` (0016) borne
 * l'un comme l'autre à la propriétaire — jointure comprise —, et 4.2 a en plus posé une garde
 * d'isolation explicite au moment de l'écriture : un fait ne peut pas pointer vers le journal
 * d'autrui.
 *
 * ── CE QUI N'EST PAS DEMANDÉ ───────────────────────────────────────────────────────────────────
 *
 * Aucun score, aucun compte, aucune colonne de confiance : il n'en existe pas en base, et le type
 * `FaitRetenu` n'en porte pas. `origine` descend en revanche, parce que l'énoncé de la story l'exige
 * — « une correction étant une donnée et non une erreur à masquer » (D6).
 */

/**
 * Assez pour un profil vivant, borné pour qu'une lecture ne devienne pas une décharge d'art. 9. Si
 * la borne mordait, elle garderait les PLUS RÉCENTS — ce qui est modifiable en premier est ce qui
 * vient d'être dit.
 */
export const MEMOIRE_FAITS_MAX = 200;

/** `YYYY-MM-DD` tel que Postgres rend un `date`. Aucune conversion en `Date` : une date civile n'est
 *  pas un instant, et la reformater par un fuseau est le geste qui fait basculer un jour. */
function jourDe(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(valeur);
  return m ? m[1] : null;
}

export async function lireFaitsRetenus(supabase: SupabaseClient): Promise<readonly FaitRetenu[]> {
  const { data, error } = await supabase.rpc("charger_faits_retenus", { p_max: MEMOIRE_FAITS_MAX });

  // ⚠️ `error` DÉSTRUCTURÉ. Sans lui, `data` vaut `null` sur une 5xx PostgREST et l'écran afficherait
  // « Anam ne retient encore rien de précis sur toi. » à quelqu'un qui a trente lignes — le défaut
  // corrigé en 4.6 puis en 4.9, et il est ici plus grave qu'ailleurs : le vide serait lu comme un
  // effacement réussi.
  if (error) throw new Error(`memoire: ${error.code ?? "echec"}`);
  if (!Array.isArray(data)) return [];

  const faits: FaitRetenu[] = [];
  for (const l of data as Array<Record<string, unknown>>) {
    const cle = l?.cle;
    const contenu = l?.contenu;
    const statut = l?.statut;
    const jour = jourDe(l?.jour);
    if (typeof cle !== "string" || typeof contenu !== "string" || typeof statut !== "string") continue;
    if (!jour) continue;
    // Une ligne mutilée est ÉCARTÉE, jamais rendue avec un champ vide : une ligne vide dans cette
    // liste se lirait comme un fait effacé, et c'est précisément l'inverse de ce qu'on montre.
    if (!estAffichable(statut, contenu)) continue;

    const srcTexte = l?.source_texte;
    const srcJour = jourDe(l?.source_jour);
    faits.push({
      cle,
      contenu,
      statut: statut === "corrige" ? "corrige" : "actif",
      jour,
      source: typeof srcTexte === "string" && srcTexte !== "" && srcJour ? { texte: srcTexte, jour: srcJour } : null,
    });
  }
  return faits;
}
