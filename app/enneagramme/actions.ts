"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { creerDepotEnneagramme } from "@/lib/data/depot-enneagramme";
import { lireTentativeEnneagramme } from "@/lib/data/lire-enneagramme";
import { ITEMS } from "@/lib/domain/enneagramme-items";
import {
  conclure,
  estNiveauReponse,
  estTypeEnneagramme,
  type ReponseItem,
  type ResultatTest,
} from "@/lib/domain/enneagramme";

/**
 * actions.ts — LES GESTES DE LA HALTE `/enneagramme` (Story 5.5, T8).
 *
 * ── LE BARÈME NE DESCEND JAMAIS, DONC LE SCORE SE CALCULE ICI ─────────────────────────────────
 *
 * Le client envoie des couples `(itemId, niveau)` — jamais un type, jamais un score. `conclure` est
 * appelé côté serveur, sur les réponses RELUES EN BASE, et c'est la seule façon de scorer du
 * produit (décision D7 : le barème vit à un seul endroit).
 *
 * ⚠️ CE QUE CES ACTIONS NE GARDENT PAS, ET C'EST ÉCRIT DANS 0049 : `authenticated` détient les sept
 * privilèges DML. Un POST direct sur `/rest/v1/` poserait le type de son choix sans avoir répondu à
 * un seul énoncé. Ce n'est pas une faille — ce sont ses propres données, aucun accès à autrui — et
 * le protéger demanderait de rejouer le barème en SQL, donc de le dupliquer. Les VRAIES gardes
 * (consentement, minorité, appartenance) sont dans les `with check` des policies.
 *
 * ── AUCUNE DE CES ACTIONS NE LÈVE ─────────────────────────────────────────────────────────────
 *
 * Elles rendent un état, et l'écran le dit. Une action qui jette produirait l'écran d'erreur de
 * Next au milieu d'un test de trois minutes — et les dix-sept réponses déjà données seraient
 * perdues de vue, alors qu'elles sont en base.
 *
 * NFR-022 : ni le type, ni les réponses ne sortent dans un message d'erreur.
 */

export type EtatTest =
  | { readonly statut: "en_cours" }
  | { readonly statut: "erreur"; readonly message: string }
  /** Le test a tranché : le type est retenu, l'écran se recharge sur le résultat. */
  | { readonly statut: "retenu" }
  /** Deux lectures à égalité — le produit REFUSE de trancher et lui rend la main (voir plus bas). */
  | { readonly statut: "indecis"; readonly exaequo: readonly number[] };

const ERREUR_GENERIQUE = "Je n’ai pas pu enregistrer. Réessaie.";

/** Le client sous JWT + son identifiant, ou `null` si la session est tombée. */
async function session() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, utilisatriceId: user.id } : null;
}

/** Filtre ce qui vient du client : identifiant connu, niveau dans 0..3. Le reste est ignoré. */
function reponsesValides(brut: unknown): ReponseItem[] {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return [];
  const connus = new Set(ITEMS.map((i) => i.id));
  return Object.entries(brut as Record<string, unknown>)
    .filter(([id, niveau]) => connus.has(id) && estNiveauReponse(niveau))
    .map(([itemId, niveau]) => ({ itemId, niveau: niveau as ReponseItem["niveau"] }));
}

/**
 * Enregistre l'état des réponses — appelée à CHAQUE réponse, en tâche de fond.
 *
 * Elle existe pour NFR-017 : une fermeture d'onglet au douzième énoncé ne perd rien. L'écran, lui,
 * n'attend pas sa réponse — il a déjà avancé. Un échec est signalé sans effacer ce qui est à
 * l'écran : les réponses vivent aussi dans l'état local, et la conclusion les renverra toutes.
 */
export async function enregistrerReponses(reponses: unknown): Promise<{ ok: boolean }> {
  try {
    const s = await session();
    if (!s) return { ok: false };
    await creerDepotEnneagramme(s.utilisatriceId, s.supabase).enregistrerReponses({
      reponses: reponsesValides(reponses),
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Conclut le test.
 *
 * ⚠️ ON RELIT LA BASE AVANT DE SCORER, et ce n'est pas de la prudence décorative : les
 * enregistrements intermédiaires sont optimistes (l'écran avance sans les attendre). Scorer la
 * charge utile du dernier envoi marcherait aujourd'hui et deviendrait faux le jour où un envoi
 * partiel arriverait. La base est la source, et l'upsert qui précède la rend complète.
 *
 * ⚠️ À ÉGALITÉ, LE PRODUIT REFUSE DE TRANCHER. `conclure` rend `indecis` avec les types à égalité —
 * départager par « le plus petit numéro » aurait biaisé silencieusement vers le type 1, et personne
 * ne l'aurait jamais vu. L'écran lui rend la main : c'est elle qui sait.
 */
export async function conclureTest(reponses: unknown): Promise<EtatTest> {
  try {
    const s = await session();
    if (!s) return { statut: "erreur", message: ERREUR_GENERIQUE };
    const depot = creerDepotEnneagramme(s.utilisatriceId, s.supabase);

    await depot.enregistrerReponses({ reponses: reponsesValides(reponses) });

    const tentative = await lireTentativeEnneagramme(s.supabase, s.utilisatriceId);
    if (tentative.statut !== "calcule") return { statut: "erreur", message: ERREUR_GENERIQUE };

    const resultat: ResultatTest = conclure(tentative.tentative.reponses, ITEMS);
    if (resultat.statut === "incomplet") return { statut: "en_cours" };
    if (resultat.statut === "indecis") return { statut: "indecis", exaequo: [...resultat.exaequo] };

    if (!(await depot.terminerTentative({ type: resultat.type }))) {
      // `false` = un autre onglet a conclu avant nous. L'état est BON — on recharge plutôt que
      // d'annoncer un échec (0049 : « l'appelant relit »).
      return { statut: "retenu" };
    }
    return { statut: "retenu" };
  } catch {
    return { statut: "erreur", message: ERREUR_GENERIQUE };
  }
}

/**
 * Le départage d'un ex æquo, PAR ELLE.
 *
 * Le type choisi doit être l'un de ceux qui sont à égalité — sinon l'écran deviendrait un menu où
 * l'on se choisit un type sans passer par le test. C'est une garde de PRODUIT, pas de sécurité : la
 * base, elle, accepte n'importe quel type de sa part, et l'en-tête de 0049 dit pourquoi.
 */
export async function departagerExAequo(type: unknown): Promise<EtatTest> {
  try {
    if (!estTypeEnneagramme(type)) return { statut: "erreur", message: ERREUR_GENERIQUE };
    const s = await session();
    if (!s) return { statut: "erreur", message: ERREUR_GENERIQUE };

    const tentative = await lireTentativeEnneagramme(s.supabase, s.utilisatriceId);
    if (tentative.statut !== "calcule") return { statut: "erreur", message: ERREUR_GENERIQUE };
    const resultat = conclure(tentative.tentative.reponses, ITEMS);
    if (resultat.statut !== "indecis" || !resultat.exaequo.includes(type)) {
      return { statut: "erreur", message: ERREUR_GENERIQUE };
    }

    await creerDepotEnneagramme(s.utilisatriceId, s.supabase).terminerTentative({ type });
    return { statut: "retenu" };
  } catch {
    return { statut: "erreur", message: ERREUR_GENERIQUE };
  }
}

/**
 * Refaire le test : on efface la passe en cours, et la SUIVANTE reçoit un nouvel identifiant.
 *
 * C'est cet identifiant qui remonte jusqu'à la `key` du composant (décision D9). Sans lui, les
 * réponses de la passe précédente survivraient à l'écran — le défaut n° 6 de la revue 4.6, le champ
 * de renommage qui fuyait d'une branche à l'autre.
 */
export async function recommencerTest(): Promise<void> {
  try {
    const s = await session();
    if (!s) redirect("/entrer");
    await creerDepotEnneagramme(s.utilisatriceId, s.supabase).abandonnerTentative();
  } catch {
    // Rien à dire : la page se recharge, et une tentative non effacée se reprend simplement.
  }
}

export type EtatHypothese =
  | { readonly statut: "repondu" }
  | { readonly statut: "erreur"; readonly message: string };

/**
 * ACCEPTER l'hypothèse d'Anam. Le type écrit est celui de la LIGNE, jamais un paramètre : accepter,
 * c'est accepter ce qui a été montré (RPC `accepter_hypothese_enneagramme`, 0049).
 */
export async function accepterHypothese(hypotheseId: string): Promise<EtatHypothese> {
  try {
    const s = await session();
    if (!s) return { statut: "erreur", message: ERREUR_GENERIQUE };
    await creerDepotEnneagramme(s.utilisatriceId, s.supabase).accepterHypothese({ hypotheseId });
    return { statut: "repondu" };
  } catch {
    // Cas réel : le consentement a été révoqué entre la proposition et l'acceptation. La RPC lève,
    // toute la transaction est annulée, et l'hypothèse RESTE en attente — l'état est cohérent.
    return { statut: "erreur", message: "Je n’ai pas pu enregistrer ça. Réessaie." };
  }
}

/**
 * REFUSER. **Aucun consentement n'est requis** : c'est le geste de celle qui vient précisément de
 * révoquer le sien, et 0049 le laisse ouvert en toutes circonstances.
 */
export async function refuserHypothese(hypotheseId: string): Promise<EtatHypothese> {
  try {
    const s = await session();
    if (!s) return { statut: "erreur", message: ERREUR_GENERIQUE };
    await creerDepotEnneagramme(s.utilisatriceId, s.supabase).refuserHypothese({ hypotheseId });
    return { statut: "repondu" };
  } catch {
    return { statut: "erreur", message: "Je n’ai pas pu enregistrer ça. Réessaie." };
  }
}

/**
 * Effacer son type. Ouvert en toutes circonstances (FR-067), sans consentement requis : retirer une
 * étiquette n'est pas en déposer une.
 */
export async function effacerType(): Promise<void> {
  try {
    const s = await session();
    if (!s) redirect("/entrer");
    await creerDepotEnneagramme(s.utilisatriceId, s.supabase).effacerType();
  } catch {
    // La page se recharge et montrera l'état réel — jamais un « c'est effacé » qui serait faux.
  }
}
