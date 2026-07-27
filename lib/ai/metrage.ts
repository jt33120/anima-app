import "server-only";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import type { TierIa } from "./port";

/**
 * Métrage IA (Story 2.2, NFR-014) — écrit l'usage du tour dans `usage_ia`.
 *
 * Extrait de la route pour rester testable, indépendamment du stream. `usage_ia` est deny-by-default
 * et NON-art. 9 → écriture via le client admin (`service_role`, tâche système autorisée, AD-12).
 * Best-effort : un échec n'est PAS fatal (l'utilisatrice a déjà sa réponse) mais est journalisé SANS
 * art. 9 (code d'erreur seul, jamais de contenu — NFR-022). **Ne lève JAMAIS** : la route l'appelle
 * dans `after()` (post-réponse) où un throw serait une promesse rejetée non gérée (revue 2.2).
 *
 * ⚠️ Portée de l'idempotence : `on conflict (utilisatrice_id, cle_idempotence) do nothing` dédoublonne
 * **une même clé**. En 2.2 la clé est un UUID SERVEUR par requête HTTP → « exactement une fois PAR
 * REQUÊTE ». La déduplication d'un **retour client** (même tour logique rejoué) exige un **jeton de
 * tour stable fourni par le client** (validé serveur, scopé à l'utilisatrice) — déféré en Phase B,
 * quand le client (qui peut retenter) existera. [voir deferred-work.md]
 */
export interface MetrageUsage {
  utilisatriceId: string;
  cleIdempotence: string;
  tier: TierIa;
  modele: string;
  tokensEntree: number;
  tokensSortie: number;
}

export async function metrerUsageIa(usage: MetrageUsage): Promise<void> {
  try {
    const admin = createSupabaseAdminClient(); // peut lever si l'env admin manque → capté ici
    const { error } = await admin.from("usage_ia").upsert(
      {
        utilisatrice_id: usage.utilisatriceId,
        cle_idempotence: usage.cleIdempotence,
        tier: usage.tier,
        modele: usage.modele,
        tokens_entree: usage.tokensEntree,
        tokens_sortie: usage.tokensSortie,
      },
      { onConflict: "utilisatrice_id,cle_idempotence", ignoreDuplicates: true },
    );
    if (error) console.error("usage_ia métrage échoué", { code: error.code });
  } catch (e) {
    // Ne jamais laisser fuiter (appelé dans after(), hors du cycle de réponse) — NFR-022.
    console.error("usage_ia métrage : exception", { nom: e instanceof Error ? e.name : "inconnu" });
  }
}

/** Données de fin de flux (l'événement `fin` de l'adaptateur), source AUTORITAIRE du métrage. */
export interface FinFlux {
  tier: TierIa;
  modele: string;
  usage: { tokensEntree: number; tokensSortie: number };
}

/** État observé pendant la consommation d'un flux, pour en dériver le métrage (pur, testable). */
export interface EtatFlux {
  /** L'événement `fin` reçu, ou `null` si le flux s'est avorté avant (pas de `fin`). */
  finRecu: FinFlux | null;
  /** Au moins un `delta` ou un `fin` a été émis (sinon : échec d'ouverture → aucune ligne fantôme). */
  aProduit: boolean;
  /** Longueur cumulée des deltas (repli d'unité TOKEN en cas d'avortement). */
  charsSortie: number;
  /** Longueur des messages envoyés (repli d'unité TOKEN en cas d'avortement). */
  charsEntree: number;
  /** Tier résolu serveur (repli si pas de `fin`). */
  tierServeur: TierIa;
  /** Modèle résolu serveur (repli si pas de `fin`). */
  modeleServeur: string;
}

export type UsageResolu = Omit<MetrageUsage, "utilisatriceId" | "cleIdempotence">;

/** ≈ 4 caractères par token — repli HOMOGÈNE en tokens (jamais de caractères dans une colonne token). */
export function estimerTokens(chars: number): number {
  return Math.ceil(Math.max(0, chars) / 4);
}

/**
 * Décide ce qu'on métré, de façon HONNÊTE (revue 2.2) :
 *  - rien produit (échec d'ouverture) → `null` (aucune ligne fantôme) ;
 *  - `fin` reçu → source AUTORITAIRE : tier/modele réellement utilisés (factice → `"factice"`, jamais
 *    un id Mistral sans appel Mistral), usage réel du fournisseur ; garde faux-zéro : un usage à 0
 *    (fournisseur qui l'omet) retombe sur l'approximation homogène ;
 *  - avortement avant `fin` → repli best-effort : tier/modele serveur, tokens estimés (unité token).
 */
export function resoudreMetrage(etat: EtatFlux): UsageResolu | null {
  if (!etat.aProduit) return null;
  if (etat.finRecu) {
    const u = etat.finRecu.usage;
    return {
      tier: etat.finRecu.tier,
      modele: etat.finRecu.modele,
      tokensEntree: u.tokensEntree > 0 ? u.tokensEntree : estimerTokens(etat.charsEntree),
      tokensSortie: u.tokensSortie > 0 ? u.tokensSortie : estimerTokens(etat.charsSortie),
    };
  }
  return {
    tier: etat.tierServeur,
    modele: etat.modeleServeur,
    tokensEntree: estimerTokens(etat.charsEntree),
    tokensSortie: estimerTokens(etat.charsSortie),
  };
}
