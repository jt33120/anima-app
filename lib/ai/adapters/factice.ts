import "server-only";
import type { AiPort, RequeteIa, ReponseIa } from "../port";
import { tierPour } from "../politique-tier";

/**
 * Adaptateur FACTICE — le chemin exercé en dev et en CI (défaut `AI_ADAPTER` hors prod).
 * Déterministe, AUCUN réseau, AUCUNE clé. Aucun SDK fournisseur importé.
 *
 * `estZdrProuve()` renvoie `true` PAR CONSTRUCTION : rien ne quitte le système (réponse générée
 * in-process), donc l'egress-guard art. 9 peut procéder en dev sans exiger les flags Mistral —
 * pas d'impasse locale pour développer la Story 2.2 dessus.
 */
export class AdaptateurFactice implements AiPort {
  estZdrProuve(): boolean {
    return true;
  }

  async completer(req: RequeteIa): Promise<ReponseIa> {
    const tier = tierPour(req.capacite);
    const dernier = req.messages.at(-1)?.content ?? "";
    const texte = `[factice] Anam a bien reçu ${req.messages.length} message(s).`;
    return {
      texte,
      tier,
      // JAMAIS un id Mistral réel : le métrage doit rester honnête sur ce qui a (ou n'a pas)
      // tourné (revue 2.1) — sinon usage_ia enregistrerait « mistral-… » sans appel Mistral.
      modele: "factice",
      usage: { tokensEntree: dernier.length, tokensSortie: texte.length },
    };
  }
}
