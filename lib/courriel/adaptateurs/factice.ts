import "server-only";
import type { PortCourriel, MotifCourriel, MotifLegal } from "@/lib/courriel/port";
import type { JetonDesabonnement } from "@/lib/domain/jeton-desabonnement";

/**
 * Story 4.9 — l'adaptateur FACTICE. In-process : rien ne quitte le système, donc rien à protéger.
 *
 * Il sert à deux choses, et la seconde compte autant que la première : tester tout le chemin sans clé
 * (le développement et la CI), et permettre à la porte pré-lancement « DPA Resend » de rester ouverte
 * sans bloquer la story. Ce qui est vérifié contre lui — l'ordre réserver-puis-envoyer, le plafond, la
 * constance du contenu — est vrai de l'adaptateur réel aussi, le port étant le même.
 */

export interface CourrielEnvoye {
  readonly destinataire: string;
  readonly motif: MotifCourriel;
  /** Retenu pour qu'un test puisse prouver que le lien de sortie est bien PROPRE à la personne. */
  readonly jeton: JetonDesabonnement;
}

/**
 * Story 3.5 — les informations LÉGALES sont retenues SÉPARÉMENT, et pas dans `envoyes`.
 *
 * Les mélanger rendrait indémontrable la propriété qui compte : « ce courriel-ci part malgré un refus de
 * canal ». Un test qui compte les envois dans un seul tableau ne saurait pas dire lequel des deux régimes
 * il vient de vérifier — et c'est exactement l'ambiguïté qui a laissé passer la garde de désabonnement
 * perdue en 4.10.
 */
export interface InformationLegaleEnvoyee {
  readonly destinataire: string;
  readonly motif: MotifLegal;
}

export interface PortCourrielFactice extends PortCourriel {
  readonly envoyes: readonly CourrielEnvoye[];
  readonly legaux: readonly InformationLegaleEnvoyee[];
}

export function creerPortCourrielFactice(options: { echoue?: boolean } = {}): PortCourrielFactice {
  const envoyes: CourrielEnvoye[] = [];
  const legaux: InformationLegaleEnvoyee[] = [];
  return {
    envoyes,
    legaux,
    estConfigure: () => true,
    async envoyer(
      destinataire: string,
      motif: MotifCourriel,
      jeton: JetonDesabonnement,
    ): Promise<void> {
      if (options.echoue) throw new Error("courriel_refuse_500");
      envoyes.push({ destinataire, motif, jeton });
    },
    async envoyerInformationLegale(destinataire: string, motif: MotifLegal): Promise<void> {
      if (options.echoue) throw new Error("courriel_refuse_500");
      legaux.push({ destinataire, motif });
    },
  };
}
