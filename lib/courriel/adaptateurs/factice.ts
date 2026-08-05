import "server-only";
import type { PortCourriel, MotifCourriel } from "@/lib/courriel/port";

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
}

export interface PortCourrielFactice extends PortCourriel {
  readonly envoyes: readonly CourrielEnvoye[];
}

export function creerPortCourrielFactice(options: { echoue?: boolean } = {}): PortCourrielFactice {
  const envoyes: CourrielEnvoye[] = [];
  return {
    envoyes,
    estConfigure: () => true,
    async envoyer(destinataire: string, motif: MotifCourriel): Promise<void> {
      if (options.echoue) throw new Error("courriel_refuse_500");
      envoyes.push({ destinataire, motif });
    },
  };
}
