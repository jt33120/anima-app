import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tirerEtDeposer } from "@/lib/data/depot-tirage";
import type { CausesRefus } from "@/lib/domain/acces-lecture";

/**
 * depot-lecture.ts — LE RITUEL, CÔTÉ DONNÉES (Story 5.8 · AD-11 / AD-12).
 *
 * ── LA FONCTION QUI PORTE TOUTE LA STORY : `ouvrirLecture` ────────────────────────────────────
 *
 * 0050 laissait écrit qu'on pouvait tirer dix fois de suite. 0051 pose l'index qui l'interdit. Ce
 * module est l'endroit où l'interdiction devient un COMPORTEMENT plutôt qu'une erreur :
 *
 *     1. lire la lecture en attente → si elle existe, rendre SA carte, ne rien tirer ;
 *     2. sinon tirer, écrire le tirage, écrire la lecture ;
 *     3. si l'insert rend `23505`, RELIRE et rendre la carte de la lecture qui a gagné la course.
 *
 * ⚠️ L'ÉTAPE 3 EST CE QUI SÉPARE UNE GARDE D'UN `if`. Sans elle, deux onglets ouverts simultanément
 * produisent deux tirages, l'un des deux inserts échoue, et l'index n'a servi qu'à faire rater une
 * utilisatrice. Avec elle, les deux onglets convergent sur la MÊME carte — ce qui est exactement ce
 * que le rituel promet.
 *
 * Coût assumé et mesuré : dans la course, le tirage perdant est déjà écrit dans `tirage`, orphelin.
 * On ne le supprime pas. Un journal d'audit enregistre ce qui s'est produit, y compris ce qui n'a
 * servi à rien ; l'effacer donnerait un journal plus propre que la réalité. Il n'est rattachable à
 * aucune lecture (`tirage_id` est unique) — il ne peut donc pas resservir.
 *
 * ── SOUS JWT, JAMAIS `service_role` (AD-12) ───────────────────────────────────────────────────
 *
 * Le client est passé en paramètre. Aucune des cinq gardes de `lecture_depot` n'est revérifiée ici :
 * les redoubler en TypeScript donnerait deux vérités, et la copie applicative finirait par diverger
 * de la policy, qui est la seule à faire foi.
 */

/** Le client Supabase porteur du JWT (AD-12). */
type ClientJwt = Pick<SupabaseClient, "from" | "rpc">;

/** Une lecture telle qu'elle vit en base. `reponse === null` ⇒ le rituel est ouvert. */
export interface Lecture {
  readonly id: string;
  readonly carte: string;
  readonly reponse: string | null;
  readonly restitution: string | null;
  readonly cleTourSource: string | null;
  readonly ouverteA: string;
}

/** La forme que Postgres rend sur la jointure — le `!inner` garantit la présence de `tirage`. */
interface LigneLecture {
  id: string;
  reponse: string | null;
  restitution: string | null;
  cle_tour_source: string | null;
  ouverte_a: string;
  tirage: { carte: string } | { carte: string }[] | null;
}

const CHAMPS = "id, reponse, restitution, cle_tour_source, ouverte_a, tirage!inner(carte)";

function versLecture(l: LigneLecture): Lecture {
  // PostgREST rend l'embed tantôt en objet, tantôt en tableau selon la cardinalité déduite. On
  // normalise ici plutôt que de parier sur la forme — un pari qui casserait en production, à la
  // première montée de version, sur un rituel en cours.
  const t = Array.isArray(l.tirage) ? l.tirage[0] : l.tirage;
  if (!t) throw new Error("lecture.lire: tirage absent (jointure inner violée)");
  return {
    id: l.id,
    carte: t.carte,
    reponse: l.reponse,
    restitution: l.restitution,
    cleTourSource: l.cle_tour_source,
    ouverteA: l.ouverte_a,
  };
}

/** Les trois prédicats SQL du refus, en UNE passe (AC7). Ne garde rien — voir `acces-lecture.ts`. */
export async function causesRefusLecture(supabase: ClientJwt): Promise<CausesRefus> {
  const { data, error } = await supabase.rpc("causes_refus_lecture");
  if (error) throw new Error(`lecture.causes: ${error.code ?? "echec"}`);
  const l = (Array.isArray(data) ? data[0] : data) as
    | { consentement_donne: boolean; barre_minorite: boolean; detresse_active: boolean }
    | undefined;
  if (!l) throw new Error("lecture.causes: reponse vide");
  return {
    consentementDonne: l.consentement_donne,
    barreMinorite: l.barre_minorite,
    detresseActive: l.detresse_active,
  };
}

/** La lecture en attente de réponse, s'il y en a une. L'index partiel garantit qu'il y en a au plus une. */
export async function lectureEnAttente(supabase: ClientJwt): Promise<Lecture | null> {
  const { data, error } = await supabase
    .from("lecture")
    .select(CHAMPS)
    .is("reponse", null)
    .maybeSingle();
  if (error) throw new Error(`lecture.enAttente: ${error.code ?? "echec"}`);
  return data ? versLecture(data as unknown as LigneLecture) : null;
}

/**
 * Ouvre le rituel — ou rend celui qui est déjà ouvert. Voir l'en-tête pour les trois étapes.
 *
 * Le drapeau `dejaOuverte` n'est pas cosmétique : il dit à la route de ne PAS ré-émettre la question
 * « Qu'est-ce que tu vois ? » sur une carte déjà présentée. Sans lui, redemander une lecture
 * reposerait la même question sous la même carte, ce qui a l'air d'un bug et l'est.
 */
export async function ouvrirLecture(
  supabase: ClientJwt,
  utilisatriceId: string,
): Promise<{ readonly lecture: Lecture; readonly dejaOuverte: boolean }> {
  const ouverte = await lectureEnAttente(supabase);
  if (ouverte) return { lecture: ouverte, dejaOuverte: true };

  const tirage = await tirerEtDeposer(supabase as Pick<SupabaseClient, "from">, utilisatriceId);

  const { data, error } = await supabase
    .from("lecture")
    .insert({ utilisatrice_id: utilisatriceId, tirage_id: tirage.id })
    .select(CHAMPS)
    .single();

  if (error) {
    // 23505 = l'index partiel a parlé : une autre requête a ouvert la lecture entre notre lecture et
    // notre insert. On ne retire pas, on ne retire jamais : on relit et on rend SA carte.
    if (error.code === "23505") {
      const gagnante = await lectureEnAttente(supabase);
      if (gagnante) return { lecture: gagnante, dejaOuverte: true };
    }
    throw new Error(`lecture.ouvrir: ${error.code ?? "echec"}`);
  }
  return { lecture: versLecture(data as unknown as LigneLecture), dejaOuverte: false };
}

/**
 * Clôt la lecture : SES mots, la restitution, et le lien vers l'échange source (FR-021).
 *
 * Une seule écriture, et elle est définitive — `lecture_cloture` n'autorise l'UPDATE que tant que
 * `reponse is null`, et `lecture_colonnes_figees` interdit de repointer la carte au passage. Le
 * `.eq("reponse", null)` n'est pas une garde (la policy l'est déjà) : il évite un aller-retour qui
 * échouerait de toute façon, et rend la condition lisible à l'endroit où on la lit.
 */
export async function cloreLecture(
  supabase: ClientJwt,
  lectureId: string,
  champs: { readonly reponse: string; readonly restitution: string; readonly cleTourSource: string },
): Promise<void> {
  const { error } = await supabase
    .from("lecture")
    .update({
      reponse: champs.reponse,
      restitution: champs.restitution,
      cle_tour_source: champs.cleTourSource,
    })
    .eq("id", lectureId)
    .is("reponse", null);
  if (error) throw new Error(`lecture.clore: ${error.code ?? "echec"}`);
}

/**
 * « Mes lectures », du plus récent au plus ancien. Les lectures ENCORE OUVERTES sont exclues : une
 * carte sans les mots de celle qui l'a reçue n'est pas une lecture, c'est une question en suspens.
 * La halte n'a pas à l'exposer, et l'exposer inviterait à y répondre hors du fil — hors du rituel.
 */
export async function listerLectures(supabase: ClientJwt): Promise<readonly Lecture[]> {
  const { data, error } = await supabase
    .from("lecture")
    .select(CHAMPS)
    .not("reponse", "is", null)
    .order("ouverte_a", { ascending: false });
  if (error) throw new Error(`lecture.lister: ${error.code ?? "echec"}`);
  return ((data ?? []) as unknown as LigneLecture[]).map(versLecture);
}
