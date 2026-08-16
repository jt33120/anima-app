/**
 * gabarits-auth.ts — LES DEUX COURRIELS QUE SUPABASE ENVOIE À NOTRE PLACE (QA tour 1, T6).
 *
 * ── POURQUOI CETTE COPIE VIT DANS LE DÉPÔT ET PAS DANS UN TABLEAU DE BORD ───────────────────────
 *
 * Ce sont les DEUX PREMIERS TEXTES qu'une personne lit de ce produit — avant l'accueil, avant Anam,
 * avant tout. Le tour de QA les a trouvés en anglais, en gabarit brut : « Your sign-in link »,
 * « Follow the link below to sign in ». Son verdict, mot pour mot : « quelqu'un a passé du temps sur
 * "la porte restera là" — et le premier courriel que reçoit cette même personne dit "Your sign-in
 * link". Tout le reste du travail de rédaction est annulé par ces trois lignes. »
 *
 * Rangés dans la configuration Supabase, ces textes échapperaient à TOUT : au contrôle de voix (2.8),
 * à la relecture d'Anima, à la revue de code, à l'historique. Ils vivent donc ici, sous les mêmes
 * gardes que le reste de la copie, et un script les pousse (`scripts/appliquer-gabarits-auth.mjs`).
 *
 * ── ⚠️ `{{ .ConfirmationURL }}`, ET RIEN D'AUTRE. NE JAMAIS ÉCRIRE `{{ .TokenHash }}` ────────────
 *
 * C'est une garde de sécurité, pas une préférence de style, et elle est éprouvée :
 * `app/auth/confirm/route.ts` a RETIRÉ le flux `?token_hash=` après l'avoir exploité de bout en bout
 * contre un vrai Supabase — un attaquant demandait un lien pour SA propre adresse, en extrayait le
 * `token_hash`, l'envoyait à la victime, et `verifyOtp` rendait une session à un navigateur neuf sans
 * le moindre `code_verifier`. La victime naviguait alors dans le compte de l'attaquant sans rien
 * voir, et tout ce qu'elle confiait ensuite à Anam — de l'article 9 — s'écrivait chez lui.
 *
 * Un gabarit qui bâtirait le lien vers NOTRE domaine avec `{{ .TokenHash }}` rouvrirait exactement
 * cette porte. `{{ .ConfirmationURL }}` passe par le `/auth/v1/verify` de Supabase et revient en
 * `?code=`, donc par PKCE, qui exige le cookie posé sur le navigateur qui a demandé le lien.
 *
 * ── CE QUE ÇA NE RÉPARE PAS, ET IL FAUT LE SAVOIR ──────────────────────────────────────────────
 *
 * Le lien continue de pointer vers `<ref>.supabase.co` avant de revenir. C'est la moitié du grief de
 * la QA (« exactement la signature visuelle d'un courriel d'hameçonnage »), et elle N'EST PAS
 * réparable ici : il faudrait un domaine d'authentification personnalisé, qui est une option payante
 * de Supabase. Porte de publication.
 *
 * En attendant, le texte fait la seule chose honnête possible : il PRÉVIENT que le lien ne ressemble
 * pas à une adresse d'Anam, et il dit pourquoi. Une personne prévenue n'est pas une personne
 * rassurée, mais elle n'est pas trompée.
 *
 * ── NFR-015 S'APPLIQUE À L'OBJET ────────────────────────────────────────────────────────────────
 *
 * L'objet paraît sur un écran verrouillé, potentiellement devant quelqu'un d'autre. Même règle que
 * les objets de `gabarits.ts` : court, sans chiffre, sans rien qui la désigne.
 */

export interface GabaritAuth {
  /** La clé de configuration Supabase de l'objet. */
  readonly cleObjet: string;
  /** La clé de configuration Supabase du corps. */
  readonly cleCorps: string;
  readonly objet: string;
  readonly corps: string;
}

/** Le placeholder Supabase, et le SEUL admis — voir l'en-tête. */
export const JETON_LIEN = "{{ .ConfirmationURL }}";

/**
 * L'enveloppe commune. Styles EN LIGNE : les clients de messagerie retirent les feuilles de style,
 * et un courriel qui s'affiche en Times New Roman brut ressemble à un courriel qu'on n'a pas écrit.
 *
 * Fond CLAIR, à rebours de l'application. Un fond sombre se retourne mal dans la moitié des clients
 * (Outlook force le blanc, Gmail inverse) et le texte y devient illisible. Un courriel n'est pas une
 * page : il ne choisit pas son thème.
 */
function enveloppe(titre: string, corps: string): string {
  return [
    `<div style="margin:0;padding:24px;background:#f4f3f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#201c42;">`,
    `<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px;">`,
    `<p style="margin:0 0 28px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#77719c;">Anam</p>`,
    `<h1 style="margin:0 0 20px;font-size:22px;font-weight:600;line-height:1.35;color:#201c42;">${titre}</h1>`,
    corps,
    `</div>`,
    `<p style="max-width:520px;margin:20px auto 0;font-size:12px;line-height:1.6;color:#6f6a85;text-align:center;">Ce message vient d'Anam. Si tu n'as rien demandé, tu peux l'ignorer : sans clic, il ne se passe rien.</p>`,
    `</div>`,
  ].join("\n");
}

/** Le bouton, et la mise en garde qui l'accompagne toujours. */
function bouton(intitule: string): string {
  return [
    `<p style="margin:0 0 28px;"><a href="${JETON_LIEN}" style="display:inline-block;padding:14px 30px;background:#201c42;color:#ffffff;text-decoration:none;border-radius:9px;font-size:16px;">${intitule}</a></p>`,
    `<p style="margin:0;font-size:14px;line-height:1.65;color:#5a5570;">Le lien passe par notre hébergeur de comptes avant de te ramener sur le site. C'est pour cela qu'il ne ressemble pas à une adresse d'Anam.</p>`,
  ].join("\n");
}

const PARAGRAPHE = `margin:0 0 22px;font-size:17px;line-height:1.65;color:#201c42;`;

/**
 * LE LIEN DE CONNEXION — le cas courant, celui d'un compte qui existe déjà.
 *
 * « Ton lien pour entrer » : quatre mots, aucun chiffre, et le mot « entrer » est celui de la porte
 * (`/entrer`) — la personne retrouve le geste qu'elle vient de faire.
 */
export const LIEN_CONNEXION: GabaritAuth = {
  cleObjet: "mailer_subjects_magic_link",
  cleCorps: "mailer_templates_magic_link_content",
  objet: "Ton lien pour entrer",
  corps: enveloppe(
    "Ton lien pour entrer",
    [
      `<p style="${PARAGRAPHE}">Voici de quoi ouvrir la porte. Ce lien ne sert qu'une fois, et il expire assez vite.</p>`,
      bouton("Entrer"),
    ].join("\n"),
  ),
};

/**
 * LA CONFIRMATION D'ADRESSE — la toute première fois.
 *
 * Elle ne dit RIEN de ce qu'on va y faire : ce courriel arrive avant le consentement art. 9, donc
 * avant que la personne ait accepté quoi que ce soit. Lui écrire « bienvenue dans ton espace
 * intime » sur un écran verrouillé serait exactement ce que NFR-015 refuse.
 */
export const CONFIRMATION_ADRESSE: GabaritAuth = {
  cleObjet: "mailer_subjects_confirmation",
  cleCorps: "mailer_templates_confirmation_content",
  objet: "Confirme ton adresse",
  corps: enveloppe(
    "Confirme ton adresse",
    [
      `<p style="${PARAGRAPHE}">Ce lien confirme que cette adresse est bien la tienne, et t'ouvre la porte dans la foulée. Il ne sert qu'une fois.</p>`,
      bouton("Confirmer et entrer"),
    ].join("\n"),
  ),
};

/** Les gabarits que ce produit envoie. Ensemble FERMÉ — tout le reste reste au défaut de Supabase. */
export const GABARITS_AUTH: readonly GabaritAuth[] = Object.freeze([LIEN_CONNEXION, CONFIRMATION_ADRESSE]);
