import type { Page } from "@playwright/test";
import { adresseNeuve, codeDans, courrielPour, viderLaBoite } from "./_boite-aux-lettres";

/**
 * Ouvrir un compte NEUF et traverser le tunnel — pour que les parcours qui suivent partent d'un
 * état connu, jamais d'un compte qu'un test précédent aurait laissé à moitié rempli.
 *
 * ⚠️ ON PASSE PAR LES VRAIS ÉCRANS, JAMAIS PAR L'ADMIN. Poser la date de naissance et le
 * consentement avec une clé `service_role` irait plus vite et prouverait moins : c'est justement
 * le tunnel qu'on veut voir tenir, et une porte qu'on contourne dans les tests est une porte que
 * personne ne teste.
 */
export type Compte = { readonly adresse: string };

export async function ouvrirUnCompteNeuf(page: Page): Promise<Compte> {
  const adresse = adresseNeuve("parcours");
  await viderLaBoite();

  await page.goto("/entrer");
  await page.getByLabel(/adresse e-mail/i).fill(adresse);
  await page.getByRole("button", { name: /recevoir mon lien/i }).click();
  await page.getByLabel(/code reçu/i).waitFor();

  const code = codeDans((await courrielPour(adresse)).corps);
  await page.getByLabel(/code reçu/i).fill(code);
  await page.getByRole("button", { name: /entrer avec ce code/i }).click();

  // ── La date de naissance (FR-012 : la majorité s'établit ici, elle ne se déclare pas ailleurs)
  await page.waitForURL(/\/naissance/);
  await page.locator('input[name="prenom"]').fill("Louise");
  await page.locator('input[name="date_naissance"]').fill("1979-09-08");
  await page.getByRole("button", { name: /continuer|commencer|suivant/i }).click();

  // ── Le consentement article 9 — les deux cases, jamais une seule
  await page.waitForURL(/\/consentement/);
  await page.locator('input[name="art9"]').check();
  await page.locator('input[name="cgu"]').check();
  await page.getByRole("button", { name: /je commence/i }).click();

  await page.waitForURL((u) => !/\/(naissance|consentement|entrer)/.test(u.pathname));
  return { adresse };
}

/**
 * Franchir le seuil, puis entrer dans une région par son nom.
 *
 * ⚠️ LE SEUIL N'A PLUS DE CONTOURNEMENT (QA manuelle du 2026-08-19), ET C'EST POURQUOI CE HELPER
 * EXISTE. La barre des trois destinations s'affichait AU SEUIL : elle offrait les trois régions
 * juste sous le bouton censé y mener, ce qui faisait du rideau une décoration. Les parcours qui
 * cliquaient « Anam » depuis le seuil marchaient donc grâce au défaut lui-même. On traverse,
 * comme quelqu'un traverse.
 *
 * La porte est franchie SI ELLE EST LÀ : qui a déjà franchi le seuil arrive directement à
 * l'accueil, et ce helper doit servir dans les deux cas.
 */
export async function entrerDansLaRegion(page: Page, nom: string | RegExp): Promise<void> {
  const porte = page.getByRole("button", { name: /entrer dans le monde/i });
  if (await porte.isVisible().catch(() => false)) await porte.click();
  await passerLeTour(page);
  await page.getByRole("navigation", { name: "Régions" }).getByRole("button", { name: nom }).click();
}

/**
 * Fermer le tour guidé s'il s'est ouvert.
 *
 * ⚠️ POURQUOI CE HELPER EXISTE, ET CE QU'IL DIT DU PRODUIT. Le tour s'ouvre TOUT SEUL à la première
 * arrivée dans le monde (retour du 2026-08-20 : « on est lancé dans le grand bain »), et c'est une
 * surimpression BLOQUANTE — la seule du produit, assumée comme telle : on ne peut pas désigner un
 * élément et laisser toucher le reste. Or chaque parcours de cette suite part d'un compte NEUF :
 * ils sont donc tous, sans exception, derrière ce voile au moment où ils franchissent la porte.
 *
 * Douze parcours l'ont découvert en même temps, et c'est le bon endroit pour le régler. Cliquer
 * ailleurs pour contourner le voile mentirait sur ce que voit une vraie personne ; on fait ce
 * qu'elle fait — on ferme le tour. `e2e/guide.spec.ts` est le seul fichier qui ne l'appelle jamais :
 * c'est son sujet.
 */
export async function passerLeTour(page: Page): Promise<void> {
  // ⚠️ ON ATTEND, ON NE SUPPOSE PAS. Un simple `isVisible()` juste après le clic sur la porte
  // interroge l'écran AVANT que l'effet d'ouverture n'ait tourné : le tour n'est pas encore là, on
  // ne le ferme pas, et le clic suivant part dans le voile. Ça passait sur téléphone et échouait
  // sur bureau — c'est-à-dire une course, donc un test qui ment une fois sur deux.
  const passer = page.getByRole("button", { name: /Passer le tour/ });
  await passer.waitFor({ state: "visible", timeout: 1200 }).catch(() => undefined);
  if (await passer.isVisible().catch(() => false)) {
    await passer.click();
    await page.getByRole("dialog").waitFor({ state: "detached" }).catch(() => undefined);
  }
}
