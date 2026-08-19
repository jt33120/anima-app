/**
 * Lire un vrai courriel — parce que le code à six chiffres n'existe nulle part ailleurs.
 *
 * GoTrue n'en stocke qu'un condensat : ni la base, ni l'API, ni le journal ne peuvent le rendre.
 * Le seul endroit où il est lisible est le message lui-même. C'est aussi ce qui rend ces parcours
 * honnêtes : ils traversent le même chemin qu'une personne, jusqu'au courriel.
 *
 * ⚠️ CE N'EST PAS INBUCKET, MALGRÉ LA SECTION `[inbucket]` DE `config.toml`. Le CLI a changé de
 * collecteur pour Mailpit sans changer le nom de la clé : l'ancienne route `/api/v1/mailbox/<nom>`
 * rend « File not found ».
 */
const MAILPIT = process.env.ANIMA_MAILPIT ?? "http://127.0.0.1:54324";

type Message = { ID: string; Subject: string; To: { Address: string }[] };

/** Une adresse jamais vue, pour que chaque parcours parte d'un compte vierge. */
export function adresseNeuve(prefixe: string): string {
  return `e2e-${prefixe}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@exemple.test`;
}

/** Vide le collecteur. À appeler avant un envoi dont on veut lire la réponse sans ambiguïté. */
export async function viderLaBoite(): Promise<void> {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });
}

/**
 * Le dernier message reçu par cette adresse. Le collecteur est asynchrone : on patiente, mais on
 * ne patiente pas indéfiniment — un courriel qui n'arrive pas est un défaut, pas une lenteur.
 */
export async function courrielPour(
  adresse: string,
  limiteMs = 15_000,
): Promise<{ sujet: string; corps: string }> {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) {
    const liste = (await (await fetch(`${MAILPIT}/api/v1/messages`)).json()) as {
      messages?: Message[];
    };
    const entree = (liste.messages ?? []).find((m) =>
      (m.To ?? []).some((t) => t.Address === adresse),
    );
    if (entree) {
      const det = (await (await fetch(`${MAILPIT}/api/v1/message/${entree.ID}`)).json()) as {
        HTML?: string;
        Text?: string;
      };
      return { sujet: entree.Subject, corps: det.HTML ?? det.Text ?? "" };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Aucun courriel pour ${adresse} après ${limiteMs} ms`);
}

/**
 * Le code du corps du message.
 *
 * ⚠️ SIX À HUIT CHIFFRES, PAS SIX. La production a envoyé des codes à HUIT chiffres pendant un
 * temps (`mailer_otp_length` valait 8 par défaut). Un extracteur qui n'accepte que six aurait
 * rendu la suite verte en local et aveugle au seul environnement qui comptait.
 */
export function codeDans(corps: string): string {
  const trouve =
    corps.match(/>\s*(\d{6,8})\s*</) ?? corps.match(/code[^0-9]{0,40}(\d{6,8})/i) ?? [];
  const code = trouve[1];
  if (!code) throw new Error("Aucun code à six chiffres dans le courriel");
  return code;
}
