import "server-only";
import type { AiPort, EvenementIa, RequeteIa, ReponseIa } from "../port";
import { tierPour } from "../politique-tier";

/**
 * Adaptateur FACTICE — le chemin exercé en dev et en CI (défaut `AI_ADAPTER` hors prod).
 * Déterministe, AUCUN réseau, AUCUNE clé. Aucun SDK fournisseur importé.
 *
 * `estZdrProuve()` renvoie `true` PAR CONSTRUCTION : rien ne quitte le système (réponse générée
 * in-process), donc l'egress-guard art. 9 peut procéder en dev sans exiger les flags Mistral —
 * pas d'impasse locale pour développer la Story 2.2 dessus.
 */
const MODELE_FACTICE = "factice"; // JAMAIS un id Mistral sans appel Mistral (métrage honnête, revue 2.1)

export class AdaptateurFactice implements AiPort {
  estZdrProuve(): boolean {
    return true;
  }

  /** Résout tier + texte + usage EN UN endroit — completer et diffuser ne divergent pas (revue 2.2). */
  private preparer(req: RequeteIa) {
    const tier = tierPour(req.capacite, req.niveauSecurite);
    const dernier = req.messages.at(-1)?.content ?? "";
    const texte = reponseFactice(req.messages.length);
    return { tier, texte, usage: { tokensEntree: dernier.length, tokensSortie: texte.length } };
  }

  async completer(req: RequeteIa): Promise<ReponseIa> {
    const { tier, texte, usage } = this.preparer(req);
    return { texte, tier, modele: MODELE_FACTICE, usage };
  }

  /**
   * Streaming déterministe (Story 2.2) : émet la même réponse que `completer`, mais fragmentée
   * par GROUPES DE MOTS (jamais caractère par caractère, NFR-014), puis un `fin` avec l'usage.
   */
  async *diffuser(req: RequeteIa): AsyncIterable<EvenementIa> {
    const { tier, texte, usage } = this.preparer(req);
    const mots = texte.split(" ");
    for (let i = 0; i < mots.length; i += 2) {
      const suite = i + 2 < mots.length ? " " : "";
      yield { type: "delta", texte: mots.slice(i, i + 2).join(" ") + suite };
    }
    yield { type: "fin", tier, modele: MODELE_FACTICE, usage };
  }
}

function reponseFactice(nbMessages: number): string {
  return `[factice] Anam a bien reçu ${nbMessages} message(s).`;
}
