import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerDepotBranche } from "@/lib/data/depot-branche";
import { journaliserIncidentSecurite } from "@/lib/safety/rpc-repli";
import { intensiteBornee, type ProjectionScene, type BrancheProjetee } from "@/lib/scene/projection";

/**
 * Story 4.6 (T4) — l'orchestrateur de la PROJECTION de l'arbre : charge les branches possédées et construit la
 * `ProjectionScene` que le rendu dessinera (muet). Appelé par `app/page.tsx` (Server Component sous JWT).
 *
 * REPLI SÛR (patron `ouverture-branche.ts`) : toute panne → un arbre VIDE (tronc seul), jamais un 500 qui
 * bloquerait l'ouverture de la scène. L'incident est journalisé sans art. 9 (NFR-022). L'arbre vide se rend
 * comme un arbre sans branche (« rien n'a encore été nommé »), pas comme une erreur.
 *
 * Le verbatim (`extraitContenu`, art. 9) remonte en DONNÉE pour la fiche (FR-027) — affichage légitime à la
 * propriétaire ; distinct de NFR-022 (logs/erreurs). La monotonie d'écriture reste le SQL (4.7) ; la défense
 * anti-régression au RENDU (reconcilierProjection) est appliquée côté client (le rendu ne peut pas logguer).
 */
/**
 * Repli SÛR — et HONNÊTE (revue 4.6, HAUTE) : `indisponible: true` distingue « je n'arrive pas à lire ton
 * arbre » de « tu n'as pas encore de branche ». Sans ce marqueur, une panne réseau affichait « Rien n'a
 * encore été nommé » à quelqu'un qui a des branches — un mensonge, et la pire régression au sens de FR-029.
 */
const ARBRE_INDISPONIBLE: ProjectionScene = { tronc: { present: true }, branches: [], indisponible: true };

/**
 * Le geste irréversible est-il suspendu (épisode en cours ou 72 h suivantes) ? Repli SÛR = `true` : le
 * doute SUSPEND. Se tromper en suspendant coûte à Sanela un geste différé de quelques heures ; se
 * tromper dans l'autre sens lui fait vivre un refus juste après lui avoir demandé de s'engager sur
 * quelque chose d'irréversible. L'asymétrie ne se discute pas.
 */
async function gestesSuspendus(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("branche_bloquee_par_detresse");
    if (error) {
      journaliserIncidentSecurite("projection_arbre_fenetre", error);
      return true;
    }
    return data === true;
  } catch (e) {
    journaliserIncidentSecurite("projection_arbre_fenetre", e);
    return true;
  }
}

/**
 * Story 4.10 (AC6 / FR-081) — le plan d'étapes est-il ouvert à l'ÉCRITURE ? Repli SÛR = `false` : le
 * doute FERME l'écriture. C'est l'inverse du repli d'`estPremiumCourante` côté commerce (où le doute
 * suspend la vente), et pour la même raison de fond — on se trompe du côté qui ne fait de mal à personne.
 * Ici, se tromper en fermant coûte un champ absent pendant quelques secondes ; se tromper en ouvrant lui
 * fait écrire deux phrases intimes que le point d'écriture refusera ensuite.
 */
async function planOuvert(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("est_premium_courante");
    if (error) {
      journaliserIncidentSecurite("projection_arbre_plan", error);
      return false;
    }
    return data === true;
  } catch (e) {
    journaliserIncidentSecurite("projection_arbre_plan", e);
    return false;
  }
}

export async function chargerProjectionArbre(supabase: SupabaseClient): Promise<ProjectionScene> {
  try {
    const branches = await creerDepotBranche(supabase).chargerBranches();
    const suspendus = await gestesSuspendus(supabase);
    // Écrire une intention est un dépôt de contenu art. 9 : la fenêtre de détresse la ferme aussi
    // (AD-17, miroir du WITH CHECK de `intention_insertion`). Deux conditions, une seule question posée
    // au rendu — il n'a pas à savoir laquelle des deux a fermé le champ, et surtout pas à le dire.
    const ouvert = !suspendus && (await planOuvert(supabase));
    const projetees: BrancheProjetee[] = branches.map((b) => ({
      id: b.id,
      etat: b.etat,
      intensite: intensiteBornee(b.intensite),
      extraitSourceId: b.extraitSourceId,
      nom: b.nom,
      dateNaissance: b.dateNaissance,
      // AC5 — « une phrase sur la fiche dit ce qui a changé et QUAND ». `undefined` (pas `null`) quand la
      // transition n'a pas eu lieu : la fiche n'affiche alors rien, plutôt qu'une date vide.
      dateFeuillaison: b.dateFeuillaison ?? undefined,
      dateRayonnement: b.dateRayonnement ?? undefined,
      extraitContenu: b.extraitContenu,
    }));
    return {
      tronc: { present: true },
      branches: projetees,
      // `undefined` plutôt que `false` : la projection ne porte que ce qui est VRAI, comme partout
      // ailleurs ici (`indisponible`, `gestesSuspendus`). Un champ absent ne se lit pas de travers.
      ...(suspendus ? { gestesSuspendus: true as const } : {}),
      ...(ouvert ? { planOuvert: true as const } : {}),
    };
  } catch (e) {
    // L'extraction du code Postgres vit DÉSORMAIS dans le journaliseur (`codeJournalisable`) : elle
    // s'applique donc à TOUS les appelants, y compris les routes qui l'avaient oubliée (re-revue).
    journaliserIncidentSecurite("projection_arbre", e);
    return ARBRE_INDISPONIBLE;
  }
}
